import type { IBouncerAuthentication, ITLSAuthentication, IWatcherAuthentication } from 'crowdsec-client';
import { ICrowdSecClientOptions } from 'crowdsec-client';
import { IncomingMessage } from 'http';
import { IScenarioConstructor, IScenarioOptions } from 'crowdsec-client-scenarios';

export type logFn = (message?: any, ...optionalParams: any[]) => void;
export type logger = {
    debug: logFn;
    warn: logFn;
    error: logFn;
    info: logFn;
    extend?: (name: string) => logger;
};
export type loggerOption = logger | ((name: string) => logger);
export interface ICommonOptions {
    /**
     * IP objects keep in cache .
     * ( usefully on really high load, without multiples instances )
     */
    maxIpCache?: number;
    logger?: loggerOption;
}

/**
 * The largest subnet the bouncer is willing to consider as potentially
 * malicious. Decisions with a larger subnet (smaller mask) are ignored.
 *
 * Real-world malicious blocks are almost always single IPs : a datacenter
 * hosts abusive customers but the whole datacenter is rarely banned. Checking
 * country-sized blocks is an extreme edge case, so this lets the operator
 * choose how far up the prefix hierarchy to look.
 */
export enum SubnetLevel {
    /** only single IPs ( /32 ) : an individual attacker */
    resident = 32,
    /** an ISP / hosting block ( up to /24 ) : abusive cloud customers */
    company = 24,
    /** a national block ( up to /16 ) : extreme case, a hostile country */
    country = 16
}

/**
 * What to do when an unknown IP appears and the live check fails ( LAPI down,
 * timeout... ). The current request always passes ( the live check runs in
 * background ), this only controls whether the failure is cached so subsequent
 * requests from the same IP are not re-tried during the backoff.
 */
export enum LiveCheckErrorBehavior {
    /** treat the failed check as "clean" for the backoff duration ( default ) */
    failOpen = 'failOpen',
    /** do not cache the failure : every request for that IP triggers a new live check */
    failFast = 'failFast'
}

export interface ICrowdSecHTTPBouncerLiveOptions {
    /**
     * enable the live mode : on a local cache miss, check the IP against the
     * LAPI in the background and block it from the next request on. Default: `false`
     */
    enabled?: boolean;
    /**
     * what to do when a live check fails. Default: `failOpen`
     */
    errorBehavior?: LiveCheckErrorBehavior;
    /**
     * how long ( in seconds ) a "clean" verdict is trusted before re-checking.
     * Default: `60`
     */
    cleanCacheTtl?: number;
    /**
     * max number of "clean" verdicts kept in memory ( LRU ). Default: `maxIpCache ?? 50000`
     */
    cleanCacheMax?: number;
    /**
     * max number of concurrent live checks against the LAPI. Default: `100`
     */
    maxConcurrentChecks?: number;
    /**
     * how long ( in seconds ) a failed check is remembered ( backoff ).
     * Default: `10`
     */
    errorBackoffTtl?: number;
    /**
     * periodically scan the index and remove expired decisions even if the
     * LAPI is unreachable and the stream `deleted` events stop coming.
     * Applies in stream mode too (a safety net on top of the stream `deleted`
     * events). Default: `true`
     */
    watchdog?: boolean;
}

export type ICrowdSecHTTPBouncerMiddlewareOptions = (IBouncerAuthentication | ITLSAuthentication) & {
    pollingInterval?: number;
    /** how far up the prefix hierarchy to consider as malicious. Default: `company` ( /24 ) */
    subnetLevel?: SubnetLevel;
    /** live mode configuration ( background checks on local misses ). Default: disabled */
    live?: ICrowdSecHTTPBouncerLiveOptions;
} & ICommonOptions;
export type ICrowdSecHTTPWatcherMiddlewareOptions = (IWatcherAuthentication | ITLSAuthentication) & {
    heartbeat?: boolean;
    scenarios?: Array<IScenarioConstructor | string>;
    scenariosOptions?: IScenarioOptions;
} & ICommonOptions;

export type getCurrentIpFn = (req: IncomingMessage) => string;

export interface ICrowdSecHTTPMiddlewareOptions extends ICommonOptions {
    url: ICrowdSecClientOptions['url'];
    bouncer?: ICrowdSecHTTPBouncerMiddlewareOptions;
    watcher?: ICrowdSecHTTPWatcherMiddlewareOptions;
    clientOptions?: Omit<ICrowdSecClientOptions, 'url'>;

    getCurrentIp?: getCurrentIpFn;
    protectedByHeader?: boolean;
}
