import {
    getCurrentIpFn,
    ICrowdSecHTTPBouncerLiveOptions,
    ICrowdSecHTTPBouncerMiddlewareOptions,
    ICrowdSecHTTPMiddlewareOptions,
    LiveCheckErrorBehavior,
    SubnetLevel
} from './ICrowdSecHTTPMiddlewareOptions.js';
import Validate from './Validate.js';
import {
    BouncerClient,
    Decision,
    DecisionsStream,
    IBouncerAuthentication,
    ICrowdSecClientOptions,
    ITLSAuthentication,
    TypedEventEmitter
} from 'crowdsec-client';
import { AddressObject } from './utils.js';
import { IpObjectsCacher } from './IpObjectsCacher.js';
import { IpDecisionDB } from './IpDecisionDB.js';
import { IncomingMessage, ServerResponse } from 'http';
import { CommonsMiddleware } from './CommonsMiddleware.js';
import { LRUCache } from 'lru-cache';

type decisionScope = 'ip' | 'range';
type decisionType = Decision<decisionScope>;

type storedDecision = {
    selector: AddressObject;
    decision: decisionType;
};

export type CrowdSecHTTPBouncerMiddlewareEvents = {
    /** decisions added by a live check ( not from the stream ) */
    liveDecisionAdded: (decisions: Array<decisionType>) => void;
    /** an IP was checked live and found clean */
    liveClean: (ip: string) => void;
    /** a live check failed ( LAPI unreachable, timeout... ) */
    liveCheckError: (ip: string, error: any) => void;
};

export class CrowdSecHTTPBouncerMiddleware extends CommonsMiddleware {
    private readonly clientOptions: ICrowdSecClientOptions;
    public readonly client: BouncerClient;
    public readonly liveEvents = new TypedEventEmitter<CrowdSecHTTPBouncerMiddlewareEvents>();

    private readonly $debugMiddleware = this.logger.extend('bouncerMiddleware');
    private readonly $debugSpawnCheck = this.logger.extend('spawnLiveCheck');
    private readonly $debugRunCheck = this.logger.extend('runLiveCheck');

    public get decisionsCount(): number {
        return this.decisionKeys.size;
    }

    /**
     * decisions indexed by CIDR ( exact /32 as well as ranges ),
     * matched with a numeric prefix lookup
     */
    private decisionsDB = new IpDecisionDB<storedDecision>();

    /**
     * unique key per decision ( value + type ), used to deduplicate
     */
    private decisionKeys = new Set<string>();
    /** decisions with a mask lower than this ( bigger subnets ) are ignored */
    private readonly minMask: number;

    /** live mode configuration */
    private readonly live: Required<Omit<ICrowdSecHTTPBouncerLiveOptions, 'cleanCacheMax'>> & {
        cleanCacheMax: number;
    };
    private cleanCache: LRUCache<string, number>;
    private errorCache: LRUCache<string, number>;
    private pendingChecks = new Map<string, Promise<void>>();
    private concurrentChecks = 0;
    private lastCapWarn = 0;
    /** periodically remove expired decisions from the index ( LAPI down safety net ) */
    private expirationScan?: NodeJS.Timeout;
    private readonly expirationScanIntervalMs = 60_000;

    private options: ICrowdSecHTTPBouncerMiddlewareOptions;
    private ipObjectCache: IpObjectsCacher;

    /**
     * allow to listen to decision events
     */
    get decisionStream(): DecisionsStream<decisionScope> | undefined {
        return this._decisionStream;
    }
    private _decisionStream?: DecisionsStream<decisionScope>;

    constructor(options: ICrowdSecHTTPBouncerMiddlewareOptions, clientOptions: ICrowdSecClientOptions, cache?: IpObjectsCacher) {
        super('CrowdSecHTTPBouncerMiddleware', options.logger);
        this.logger.debug('construct');

        this.options = options;
        this.clientOptions = clientOptions;
        this.minMask = options.subnetLevel ?? SubnetLevel.company;
        this.live = {
            enabled: options.live?.enabled ?? false,
            errorBehavior: options.live?.errorBehavior ?? LiveCheckErrorBehavior.failOpen,
            cleanCacheTtl: options.live?.cleanCacheTtl ?? 60,
            cleanCacheMax: options.live?.cleanCacheMax ?? options.maxIpCache ?? 50000,
            maxConcurrentChecks: options.live?.maxConcurrentChecks ?? 100,
            errorBackoffTtl: options.live?.errorBackoffTtl ?? 10,
            watchdog: options.live?.watchdog ?? true
        };
        this.cleanCache = new LRUCache<string, number>({
            max: this.live.cleanCacheMax,
            ttl: this.live.cleanCacheTtl * 1000
        });
        this.errorCache = new LRUCache<string, number>({
            max: this.live.cleanCacheMax,
            ttl: this.live.errorBackoffTtl * 1000
        });

        const auth = this.getBouncerAuthentication(options);
        this.client = new BouncerClient({
            url: this.clientOptions.url,
            userAgent: this.clientOptions.userAgent,
            timeout: this.clientOptions.timeout,
            strictSSL: this.clientOptions.strictSSL,
            auth
        });

        this.ipObjectCache = cache ?? new IpObjectsCacher(options.maxIpCache);
    }

    private getBouncerAuthentication(bouncerOptions: ICrowdSecHTTPMiddlewareOptions['bouncer']) {
        this.logger.debug('getBouncerAuthentication');
        if (Validate.implementsTKeys<ITLSAuthentication>(bouncerOptions, ['key', 'ca', 'cert'])) {
            return {
                cert: bouncerOptions.cert,
                key: bouncerOptions.key,
                ca: bouncerOptions.ca
            } as ITLSAuthentication;
        }

        if (Validate.implementsTKeys<IBouncerAuthentication>(bouncerOptions, ['apiKey'])) {
            return {
                apiKey: bouncerOptions.apiKey
            } as IBouncerAuthentication;
        }

        throw new Error('bad client configuration');
    }

    public async start() {
        this.logger.info('start');
        await this.client.login();

        this._decisionStream = this.client.Decisions.getStream({
            interval: this.options?.pollingInterval,
            scopes: ['ip', 'range']
        });

        this._decisionStream.on('error', (e) => {
            this.logger.error('client stream error', e);
        });

        this._decisionStream.on('added', (decision) => {
            try {
                this.addDecision(decision);
            } catch (e) {
                this.logger.error('fail to add decision', e, decision);
            }
        });

        this._decisionStream.on('deleted', (decision) => {
            this.removeDecision(decision);
        });

        this._decisionStream.resume();

        if (this.live.watchdog) {
            // remove expired decisions even if the LAPI is down and the stream
            // `deleted` events stop coming
            this.expirationScan = setInterval(() => this.removeExpiredDecisions(), this.expirationScanIntervalMs);
            this.expirationScan.unref?.();
        }
    }

    private removeExpiredDecisions() {
        const now = Date.now();
        const removed = this.decisionsDB.removeIf(({ decision }) => (decision.endAt?.getTime() ?? 0) <= now);
        for (const { decision } of removed) {
            this.decisionKeys.delete(this.decisionKey(decision));
        }
        if (removed.length > 0) {
            this.logger.debug('removed %o expired decisions', removed.length);
        }
    }

    private decisionKey(decision: decisionType): string {
        return `${decision.value}:${decision.type}`;
    }

    private addDecision(decision: decisionType): boolean {
        const key = this.decisionKey(decision);
        if (this.decisionKeys.has(key)) {
            return false;
        }
        const ipObject = this.ipObjectCache.getIpObjectWithCache(decision.value);

        // ignore decisions with a bigger subnet than configured (e.g. /8 country blocks)
        if (ipObject.subnetMask < this.minMask) {
            this.logger.debug('ignore decision %s: subnet mask %o < minMask %o', decision.value, ipObject.subnetMask, this.minMask);
            return false;
        }

        const stored: storedDecision = { decision, selector: ipObject };

        this.decisionsDB.insert(ipObject, stored);
        this.decisionKeys.add(key);
        return true;
    }

    private removeDecision(decision: decisionType) {
        const key = this.decisionKey(decision);
        if (!this.decisionKeys.has(key)) {
            return;
        }
        const ipObject = this.ipObjectCache.getIpObjectWithCache(decision.value);

        const removed = this.decisionsDB.delete(ipObject, ({ decision: d }) => this.isSameDecision(d, decision));
        if (removed) {
            this.decisionKeys.delete(key);
        }
    }

    private isSameDecision(d1: Decision<any>, d2: Decision<any>) {
        return d1.value === d2.value && d1.type === d2.type;
    }

    public async stop() {
        this.logger.info('stop');
        if (this.expirationScan) {
            clearInterval(this.expirationScan);
            this.expirationScan = undefined;
        }
        this.pendingChecks.clear();
        this.cleanCache.clear();
        this.errorCache.clear();
        return this.client.stop();
    }

    public middleware(ip: string, req: IncomingMessage & { decision?: Decision<any> }) {
        const localDebug = this.$debugMiddleware;
        localDebug.debug('start');

        const currentAddress = this.ipObjectCache.getIpObjectWithCache(ip);

        localDebug.debug('bouncerMiddleware receive request from %s', currentAddress.addressMinusSuffix);
        localDebug.debug('start decision loop');
        const decision = this.decisionsDB.lookup(currentAddress);
        localDebug.debug('end decision loop');

        if (decision) {
            req.decision = decision.decision;
            localDebug.debug('end (banned)');
            return;
        }

        if (this.live.enabled) {
            // always check the local index first, then the clean cache : a live
            // ban is inserted in the DB, so the DB lookup above already catches it
            if (this.cleanCache.has(ip)) {
                localDebug.debug('end (clean, cached)');
                return;
            }
            if (this.live.errorBehavior === LiveCheckErrorBehavior.failOpen && this.errorCache.has(ip)) {
                localDebug.debug('end (clean, live check failed recently)');
                return;
            }
            this.spawnLiveCheck(ip);
        }
        localDebug.debug('end');
    }

    /**
     * fire & forget a live check, deduplicated per ip ( thundering herd ) and
     * capped globally. The current request is never blocked.
     */
    private spawnLiveCheck(ip: string) {
        const localDebug = this.$debugSpawnCheck;
        if (this.pendingChecks.has(ip)) {
            localDebug.debug('skip, already checking %s', ip);
            return;
        }
        if (this.concurrentChecks >= this.live.maxConcurrentChecks) {
            localDebug.debug('skip, max concurrent checks reached');
            const now = Date.now();
            if (now - this.lastCapWarn > 1000) {
                this.lastCapWarn = now;
                this.logger.warn('live checks capped at %o, skipping new ip checks', this.live.maxConcurrentChecks);
            }
            return;
        }

        localDebug.debug('checking %s', ip);
        this.concurrentChecks++;
        const check = this.runLiveCheck(ip);
        this.pendingChecks.set(ip, check);
        check.finally(() => {
            this.concurrentChecks--;
            this.pendingChecks.delete(ip);
        });
    }

    private async runLiveCheck(ip: string): Promise<void> {
        const localDebug = this.$debugRunCheck;
        try {
            const decisions = await this.client.Decisions.search({ ip });
            localDebug.debug('got %o decisions for %s', decisions.length, ip);

            const blocking = decisions.filter((d): d is decisionType => {
                if (d.type !== 'ban' && d.type !== 'captcha') {
                    return false;
                }
                const ipObject = this.ipObjectCache.getIpObjectWithCache(d.value);
                return ipObject.subnetMask >= this.minMask;
            });

            if (blocking.length === 0) {
                this.cleanCache.set(ip, Date.now());
                this.emitLiveEvent('liveClean', ip);
                return;
            }

            const added: Array<decisionType> = [];
            for (const d of blocking) {
                if (this.addDecision(d)) {
                    added.push(d);
                }
            }
            // hygiene : do not serve a stale "clean" verdict for this exact ip
            this.cleanCache.delete(ip);
            if (added.length > 0) {
                this.emitLiveEvent('liveDecisionAdded', added);
            }
        } catch (e) {
            localDebug.debug('live check failed for %s : %o', ip, e);
            if (this.live.errorBehavior === LiveCheckErrorBehavior.failOpen) {
                this.errorCache.set(ip, Date.now());
            }
            this.emitLiveEvent('liveCheckError', ip, e);
        }
    }

    /** emit a live event without letting a throwing listener break the flow */
    private emitLiveEvent<E extends keyof CrowdSecHTTPBouncerMiddlewareEvents>(
        event: E,
        ...args: Parameters<CrowdSecHTTPBouncerMiddlewareEvents[E]>
    ) {
        try {
            this.liveEvents.emit(event, ...args);
        } catch (e) {
            this.logger.error('live event %s listener failed', String(event), e);
        }
    }

    public getMiddleware(getIpFromRequest: getCurrentIpFn) {
        return (req: IncomingMessage, res: ServerResponse) => {
            const ip = getIpFromRequest(req);

            this.middleware(ip, req);
        };
    }
}
