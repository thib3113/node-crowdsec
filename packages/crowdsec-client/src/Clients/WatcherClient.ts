import { CrowdSecClient } from './CrowdSecClient.js';
import { createDebugger } from '../utils.js';
import type { IHTTPOptions, ITLSAuthentication, IWatcherAuthentication, IWatcherClientOptions } from '../interfaces/index.js';
import type { AxiosResponse } from 'axios';
import type { WatcherAuthRequest, WatcherAuthResponse, WatcherRegistrationRequest } from '../types/index.js';
import { DecisionsWatcher } from '../Decisions/DecisionsWatcher.js';
import { Alerts } from '../Alerts/Alerts.js';
import { CrowdsecClientError, EErrorsCodes } from '../Errors/index.js';
import Validate from '../Validate.js';

export class WatcherClient extends CrowdSecClient {
    protected debug = createDebugger('WatcherClient');

    private autoRenewTimeout?: NodeJS.Timeout;
    private heartbeatTimeout?: NodeJS.Timeout;

    private readonly auth?: Omit<IWatcherAuthentication, 'password'>;
    readonly #password?: string;

    public Decisions: DecisionsWatcher;
    public Alerts: Alerts;
    private readonly heartbeat: boolean | number;
    readonly scenarios: Array<string>;

    constructor(options: IWatcherClientOptions) {
        super(options);

        if (!options?.auth) {
            throw new CrowdsecClientError('options.auth is needed when creating a watcher client');
        }

        if (Validate.implementsTKeys<ITLSAuthentication>(options.auth, ['key', 'cert', 'ca'])) {
            this.setAuthenticationByTLS(options.auth);
        } else if (options.auth) {
            this.#password = options.auth.password;
            this.auth = {
                autoRenew: options.auth.autoRenew ?? true,
                machineID: options.auth.machineID
            };
        }

        this.scenarios = options.scenarios ?? [];
        this.heartbeat = options.heartbeat ?? true;

        this.Decisions = new DecisionsWatcher({ httpClient: this.http });
        this.Alerts = new Alerts({ httpClient: this.http });
    }

    private async _login() {
        const localDebug = this.debug.extend('_login');
        localDebug('start _login');

        if (this.autoRenewTimeout) {
            clearTimeout(this.autoRenewTimeout);
        }

        try {
            const data: Partial<WatcherAuthRequest> = {
                scenarios: this.scenarios
            };
            if (this.auth) {
                data.machine_id = this.auth.machineID;
                data.password = this.#password;
            }

            const res = (
                await this.http.post<WatcherAuthResponse, AxiosResponse<WatcherAuthResponse>, Partial<WatcherAuthRequest>>(
                    '/v1/watchers/login',
                    data
                )
            ).data;

            if (!res.token || !res.expire) {
                throw new CrowdsecClientError('fail to get token', EErrorsCodes.CONNECTION_FAILED);
            }

            this.setAuthenticationHeaders({
                Authorization: `Bearer ${res.token}`
            });

            if (!this.auth || this.auth.autoRenew) {
                // 5m
                const renewTimeBeforeEnd = 5 * 60 * 1000;
                const renewInTime = new Date(res.expire).getTime() - renewTimeBeforeEnd - Date.now();

                localDebug('next token renew planned at %o', new Date(Date.now() + renewInTime));
                this.autoRenewTimeout = setTimeout(() => {
                    this._login().catch((e) => localDebug('uncatched error in _login %o', e));
                }, renewInTime);
            }
        } catch (e) {
            localDebug('fail to get token');
            throw e;
        }
    }

    async login(): Promise<void> {
        await this._login();
        const connectionResult = await this.testConnection();
        if (this.heartbeat) {
            this.heartbeatLoop().catch((e) => this.debug('uncatched error from starting heartbeatLoop : %o', e));
        }
        return connectionResult;
    }

    public async testConnection(): Promise<void> {
        return this._testConnection('/v1/alerts');
    }

    private async heartbeatLoop() {
        const localDebug = this.debug.extend('heartbeatLoop');
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
        }

        localDebug('start heartbeat');

        try {
            await this.http.get('/v1/heartbeat');
            localDebug('Heartbeat sent');
        } catch (e) {
            localDebug('error %o', e);
        } finally {
            const timer = typeof this.heartbeat === 'number' ? this.heartbeat : 30000;
            localDebug('next heartbeat will be send at %o', new Date(Date.now() + timer));
            setTimeout(() => {
                this.heartbeatLoop().catch((e) => this.debug('uncatched error from heartbeatLoop : %o', e));
            }, timer);
        }
    }

    /**
     * Allow to register a watcher on CLAPI
     * you need to validate on the local machine
     * @param options
     */
    public async registerWatcher(options: WatcherRegistrationRequest) {
        return (await this.http.post<null, AxiosResponse<null>, WatcherRegistrationRequest>('/v1/watchers', options)).data;
    }

    public static async registerWatcher(options: WatcherRegistrationRequest & IHTTPOptions) {
        const httpClient = CrowdSecClient.getHTTPClient({
            url: options.url,
            userAgent: options.userAgent,
            timeout: options.timeout,
            strictSSL: options.strictSSL
        });

        return (
            await httpClient.post<null, AxiosResponse<null>, WatcherRegistrationRequest>('/v1/watchers', {
                password: options.password,
                machine_id: options.machine_id
            })
        ).data;
    }

    public async stop() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
        }
        if (this.autoRenewTimeout) {
            clearTimeout(this.autoRenewTimeout);
        }
    }
}
