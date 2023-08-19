import { getCurrentIpFn, ICrowdSecHTTPBouncerMiddlewareOptions, ICrowdSecHTTPMiddlewareOptions } from './ICrowdSecHTTPMiddlewareOptions.js';
import Validate from './Validate.js';
import {
    BouncerClient,
    Decision,
    DecisionsStream,
    IBouncerAuthentication,
    ICrowdSecClientOptions,
    ITLSAuthentication
} from 'crowdsec-client';
import { AddressObject } from './utils.js';
import { IpObjectsCacher } from './IpObjectsCacher.js';
import { IncomingMessage, ServerResponse } from 'http';
import { CommonsMiddleware } from './CommonsMiddleware.js';

type decisionScope = 'ip' | 'range';
type decisionType = Decision<decisionScope>;

export class CrowdSecHTTPBouncerMiddleware extends CommonsMiddleware {
    private readonly clientOptions: ICrowdSecClientOptions;
    public readonly client: BouncerClient;

    //TODO store this on updates
    public get decisionsCount(): number {
        return Object.keys(this.decisions || {}).reduce((previousValue, key) => previousValue + (this.decisions[key]?.length || 0), 0);
    }

    private decisions: Record<string, Array<{ selector: AddressObject; decision: decisionType }>> = {};
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

        let timeout: NodeJS.Timeout | undefined;
        this._decisionStream.on('added', (decision) => {
            try {
                // TODO this method doesn't support range including multiple top level group
                const ipObject = this.ipObjectCache.getIpObjectWithCache(decision.value);
                const decisionId = ipObject.parsedAddress[0];

                if (!this.decisions[decisionId]) {
                    this.decisions[decisionId] = [];
                }

                if (!this.decisions[decisionId].find(({ decision: d }) => this.isSameDecision(d, decision))) {
                    this.decisions[decisionId].push({ decision, selector: this.ipObjectCache.getIpObjectWithCache(decision.value) });
                }
            } catch (e) {
                this.logger.error('fail to add decision', e, decision);
            }
        });

        this._decisionStream.on('deleted', (decision) => {
            const ipObject = this.ipObjectCache.getIpObjectWithCache(decision.value);
            const decisionId = ipObject.parsedAddress[0];
            this.decisions[decisionId] = (this.decisions[decisionId] || []).filter(({ decision: d }) => !this.isSameDecision(d, decision));
        });

        this._decisionStream.resume();
    }

    private isSameDecision(d1: Decision<any>, d2: Decision<any>) {
        return d1.value === d2.value && d1.type === d2.type;
    }

    public async stop() {
        this.logger.info('stop');
        return this.client.stop();
    }

    public middleware(ip: string, req: IncomingMessage & { decision?: Decision<any> }) {
        const localDebug = this.logger.extend('bouncerMiddleware');
        localDebug.debug('start');

        const currentAddress = this.ipObjectCache.getIpObjectWithCache(ip);

        localDebug.debug('bouncerMiddleware receive request from %s', currentAddress.addressMinusSuffix);
        localDebug.debug('start decision loop');
        const decision = (this.decisions[currentAddress.parsedAddress[0]] || []).find(({ selector }) =>
            currentAddress.isInSubnet(selector)
        );
        localDebug.debug('end decision loop');

        if (decision) {
            req.decision = decision.decision;
        }
        localDebug.debug('end');
    }

    public getMiddleware(getIpFromRequest: getCurrentIpFn) {
        return (req: IncomingMessage, res: ServerResponse) => {
            const ip = getIpFromRequest(req);

            this.middleware(ip, req);
        };
    }
}
