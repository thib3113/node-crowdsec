import { ICrowdSecHTTPMiddlewareOptions } from './ICrowdSecHTTPMiddlewareOptions.js';
import { ICrowdSecClientOptions } from 'crowdsec-client';
import { pkg } from './pkg.js';
import { AddressObject, createDebugger } from './utils.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { CrowdSecHTTPBouncerMiddleware } from './CrowdSecHTTPBouncerMiddleware.js';
import { IpObjectsCacher } from './IpObjectsCacher.js';
import { CrowdSecHTTPWatcherMiddleware } from './CrowdSecHTTPWatcherMiddleware.js';

const defaultClientOptions: Partial<ICrowdSecHTTPMiddlewareOptions['clientOptions']> = {
    userAgent: `${pkg.name}/v${pkg.version}`
};
const debug = createDebugger('CrowdSecHTTPMiddleware');

export class CrowdSecHTTPMiddleware {
    private readonly clientOptions: ICrowdSecClientOptions;
    private options: ICrowdSecHTTPMiddlewareOptions;

    public readonly watcher?: CrowdSecHTTPWatcherMiddleware;
    public readonly bouncer?: CrowdSecHTTPBouncerMiddleware;
    private ipObjectCache: IpObjectsCacher;

    constructor(options: ICrowdSecHTTPMiddlewareOptions) {
        debug('construct');
        this.options = {
            protectedByHeader: true,
            ...options
        };
        this.clientOptions = {
            ...defaultClientOptions,
            ...options.clientOptions,
            url: options.url
        };

        this.ipObjectCache = new IpObjectsCacher(options.maxIpCache);

        if (options.watcher) {
            this.watcher = new CrowdSecHTTPWatcherMiddleware(options.watcher, this.clientOptions);
        }

        if (options.bouncer) {
            this.bouncer = new CrowdSecHTTPBouncerMiddleware(options.bouncer, this.clientOptions);
        }
    }

    public async start() {
        debug('start');

        debug('login');
        await Promise.all([
            this.bouncer ? this.bouncer.start() : Promise.resolve(),
            this.watcher ? this.watcher.start() : Promise.resolve()
        ]);
    }

    /**
     * extract current ip from the request .
     * First try the option getCurrentIp, second check if a scenario allow to extractIp
     * @param req
     * @private
     */
    private getCurrentIpFromRequest(req: IncomingMessage): string {
        if (this.options.getCurrentIp) {
            return this.options.getCurrentIp(req);
        }

        const ip = this.watcher?.extractIp(req);

        if (!ip) {
            throw new Error('no scenario can extract the ip from this request . And no option "getCurrentIp" to extract it');
        }

        return ip;
    }

    private getIpObjectFromReq(req: IncomingMessage & { ip?: string }): AddressObject {
        const ip = this.getCurrentIpFromRequest(req);

        req.ip = ip;

        return this.ipObjectCache.getIpObjectWithCache(ip);
    }

    protected middlewareFunction = (req: IncomingMessage, res: ServerResponse) => {
        const currentIp = this.getIpObjectFromReq(req);

        if (!currentIp.addressMinusSuffix) {
            // checking the code of the lib, it seems that this will never happen
            // https://github.com/beaugunderson/@laverdet/beaugunderson-ip-address/issues/143
            throw new Error('fail to get address without suffix');
        }

        this.bouncer?.middleware(currentIp.addressMinusSuffix, req);

        this.watcher?.middleware(currentIp.addressMinusSuffix, req);

        if (this.options.protectedByHeader) {
            res.appendHeader('X-Protected-By', 'CrowdSec');
        }
    };

    public getMiddleware() {
        debug('getMiddleware');
        return this.middlewareFunction;
    }

    public async stop() {
        debug('stop');
        await Promise.all([this.bouncer?.stop(), this.watcher?.stop()]);
    }
}
