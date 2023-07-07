import { getCurrentIpFn, ICrowdSecHTTPBouncerMiddlewareOptions, ICrowdSecHTTPMiddlewareOptions } from './ICrowdSecHTTPMiddlewareOptions.js';
import Validate from './Validate.js';
import { BouncerClient, Decision, IBouncerAuthentication, ICrowdSecClientOptions, ITLSAuthentication } from 'crowdsec-client';
import { AddressObject, createDebugger } from './utils.js';
import { IpObjectsCacher } from './IpObjectsCacher.js';
import { IncomingMessage, ServerResponse } from 'http';

type decisionType = Decision<'ip' | 'range'>;

const debug = createDebugger('CrowdSecHTTPBouncerMiddleware');
export class CrowdSecHTTPBouncerMiddleware {
    private readonly clientOptions: ICrowdSecClientOptions;
    private readonly bouncer: BouncerClient;
    private decisions: Record<string, Array<{ selector: AddressObject; decision: decisionType }>> = {};
    private options: ICrowdSecHTTPBouncerMiddlewareOptions;
    private ipObjectCache: IpObjectsCacher;

    constructor(options: ICrowdSecHTTPBouncerMiddlewareOptions, clientOptions: ICrowdSecClientOptions, cache?: IpObjectsCacher) {
        debug('construct');
        this.options = options;
        this.clientOptions = clientOptions;

        const auth = this.getBouncerAuthentication(options);
        this.bouncer = new BouncerClient({
            url: this.clientOptions.url,
            userAgent: this.clientOptions.userAgent,
            timeout: this.clientOptions.timeout,
            strictSSL: this.clientOptions.strictSSL,
            auth
        });

        this.ipObjectCache = cache || new IpObjectsCacher(options.maxIpCache);
    }

    private getBouncerAuthentication(bouncerOptions: ICrowdSecHTTPMiddlewareOptions['bouncer']) {
        debug('getBouncerAuthentication');
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

        throw new Error('bad bouncer configuration');
    }

    public async start() {
        await this.bouncer.login();

        const stream = this.bouncer.Decisions.getStream({
            interval: this.options?.pollingInterval || undefined,
            scopes: ['ip', 'range']
        });

        stream.on('error', (e) => {
            debug('bouncer stream error : %o', e);
        });

        stream.on('added', (decision) => {
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
                debug('fail to add decision %o : ', decision, e);
            }
        });

        stream.on('deleted', (decision) => {
            const ipObject = this.ipObjectCache.getIpObjectWithCache(decision.value);
            const decisionId = ipObject.parsedAddress[0];
            this.decisions[decisionId] = this.decisions[decisionId].filter(({ decision: d }) => !this.isSameDecision(d, decision));
        });

        stream.resume();
    }

    private isSameDecision(d1: Decision<any>, d2: Decision<any>) {
        return d1.value === d2.value && d1.type === d2.type;
    }

    public async stop() {
        debug('stop');
        return this.bouncer.stop();
    }

    public middleware(ip: string, req: IncomingMessage & { decision?: Decision<any> }) {
        console.time('bouncerMiddleware');
        const currentAddress = this.ipObjectCache.getIpObjectWithCache(ip);

        debug('bouncerMiddleware receive request from %s', currentAddress.addressMinusSuffix);
        console.time('bouncerMiddleware.loop');
        const decision = (this.decisions[currentAddress.parsedAddress[0]] || []).find(({ selector }) =>
            currentAddress.isInSubnet(selector)
        );
        console.timeEnd('bouncerMiddleware.loop');

        if (decision) {
            req.decision = decision.decision;
        }
        console.timeEnd('bouncerMiddleware');
    }

    public getMiddleware(getIpFromRequest: getCurrentIpFn) {
        return (req: IncomingMessage, res: ServerResponse) => {
            const ip = getIpFromRequest(req);

            this.middleware(ip, req);
        };
    }
}
