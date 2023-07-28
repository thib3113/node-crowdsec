import type { IBouncerAuthentication, ITLSAuthentication, IWatcherAuthentication } from 'crowdsec-client';
import { ICrowdSecClientOptions } from 'crowdsec-client';
import { IncomingMessage } from 'http';
import { IScenarioConstructor, IScenarioOptions } from 'crowdsec-client-scenarios';

export interface ICommonOptions {
    /**
     * IP objects keep in cache .
     * ( usefully on really high load, without multiples instances )
     */
    maxIpCache?: number;
}

export type ICrowdSecHTTPBouncerMiddlewareOptions = (IBouncerAuthentication | ITLSAuthentication) & {
    pollingInterval?: number;
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
