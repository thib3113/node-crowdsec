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
