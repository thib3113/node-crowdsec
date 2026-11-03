import { CrowdSecClient } from './CrowdSecClient.js';
import { createDebugger } from '../utils.js';
import type { IHTTPOptions, ITLSAuthentication, IWatcherAuthentication, IWatcherClientOptions } from '../interfaces/index.js';
import type { AxiosResponse } from 'axios';
import type { WatcherAuthRequest, WatcherAuthResponse, WatcherRegistrationRequest } from '../types/index.js';
import { LapiCapability } from '../Capabilities.js';
import { DecisionsWatcher } from '../Decisions/DecisionsWatcher.js';
import { Alerts } from '../Alerts/Alerts.js';
import { Allowlists } from '../Allowlists/Allowlists.js';
import { CrowdsecClientError, EErrorsCodes } from '../Errors/index.js';
import Validate from '../Validate.js';

export class WatcherClient extends CrowdSecClient {
    protected debug = createDebugger('WatcherClient');

    private autoRenewTimeout?: NodeJS.Timeout;
    private heartbeatTimeout?: NodeJS.Timeout;
    private stopped = false;

    private readonly auth?: Omit<IWatcherAuthentication, 'password'>;
    readonly #password?: string;

    public Decisions: DecisionsWatcher;
    public Alerts: Alerts;
    public Allowlists: Allowlists;
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

        this.Decisions = new DecisionsWatcher({ httpClient: this.http, capabilities: this.capabilityContext });
        this.Alerts = new Alerts({ httpClient: this.http, capabilities: this.capabilityContext });
        this.Allowlists = new Allowlists({ httpClient: this.http, capabilities: this.capabilityContext });
    }

    private async _login() {
        const localDebug = this.debug.extend('_login');
        localDebug('start _login');

        if (this.stopped) {
            localDebug('client is stopped, skipping login');
            return;
        }

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

            if (!this.stopped && (!this.auth || this.auth.autoRenew)) {
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
        if (this.stopped) {
            throw new CrowdsecClientError('client is stopped', EErrorsCodes.CONNECTION_FAILED);
        }

        await this._login();
        if (this.stopped) {
            throw new CrowdsecClientError('client is stopped', EErrorsCodes.CONNECTION_FAILED);
        }
        const connectionResult = await this.testConnection();

        if (this.options.detectCapabilities) {
            await this.detectCapabilities();
        }

        if (!this.stopped && this.heartbeat && this.supports(LapiCapability.heartbeat) !== false) {
            this.heartbeatLoop().catch((e) => this.debug('uncatched error from starting heartbeatLoop : %o', e));
        }
        return connectionResult;
    }

    protected async collectProbes() {
        // A watcher JWT is rejected on `/v1/decisions` (bouncer route), so probe
        // the equivalent alert filters instead of inheriting decision probes.
        return [
            {
                capability: LapiCapability.containsFilter,
                // Match the bouncer probe: `contains` is only meaningful with
                // ip/range, so send a TEST-NET address.
                request: () => this.http.get('/v1/alerts', { params: { contains: false, ip: '192.0.2.1', limit: 1 } })
            },
            {
                capability: LapiCapability.alertOriginFilter,
                request: () => this.http.get('/v1/alerts', { params: { origin: 'cscli', limit: 1 } })
            },
            {
                capability: LapiCapability.heartbeat,
                request: () => this.http.get('/v1/heartbeat')
            },
            {
                capability: LapiCapability.allowlists,
                // Do not download every allowlist item just to detect the route.
                request: () => this.http.get('/v1/allowlists', { params: { with_content: false } })
            },
            {
                capability: LapiCapability.allowlistsBulkCheck,
                request: () => this.http.post('/v1/allowlists/check', { targets: [] })
            },
            {
                capability: LapiCapability.alertKindFilter,
                request: () => this.http.get('/v1/alerts', { params: { kind: 'cscli', limit: 1 } })
            }
        ];
    }

    public async testConnection(): Promise<void> {
        return this._testConnection('/v1/alerts');
    }

    private async heartbeatLoop() {
        const localDebug = this.debug.extend('heartbeatLoop');
        if (this.stopped) {
            return;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
        }

        if (this.supports(LapiCapability.heartbeat) === false) {
            localDebug('heartbeat is not supported by this LAPI, disabling it');
            return;
        }

        localDebug('start heartbeat');

        let disable = false;
        try {
            await this.http.get('/v1/heartbeat');
            localDebug('Heartbeat sent');
        } catch (e) {
            localDebug('error %o', e);
            if ((e as { code?: unknown } | undefined)?.code === 404) {
                // Older LAPIs have no heartbeat route: stop retrying and record
                // the fact so a declared/known state stays consistent.
                this.capabilityContext.learn(LapiCapability.heartbeat, false);
                disable = true;
                localDebug('heartbeat route not found, disabling the loop');
            }
        } finally {
            if (disable || this.stopped) {
                this.heartbeatTimeout = undefined;
            } else {
                const timer = typeof this.heartbeat === 'number' ? this.heartbeat : 30000;
                if (timer <= 0) {
                    this.heartbeatTimeout = undefined;
                } else {
                    localDebug('next heartbeat will be send at %o', new Date(Date.now() + timer));
                    this.heartbeatTimeout = setTimeout(() => {
                        this.heartbeatLoop().catch((e) => this.debug('uncatched error from heartbeatLoop : %o', e));
                    }, timer);
                }
            }
        }
    }

    /**
     * Allow to register a watcher on CLAPI
     * you need to validate on the local machine
     * @remarks The optional `registration_token` field requires CrowdSec LAPI 1.6.3 or newer.
     * @param options
     */
    public async registerWatcher(options: WatcherRegistrationRequest) {
        return (await this.http.post<null, AxiosResponse<null>, WatcherRegistrationRequest>('/v1/watchers', options)).data;
    }

    /**
     * Register a watcher without keeping a client instance.
     * @remarks The optional `registration_token` field requires CrowdSec LAPI 1.6.3 or newer.
     */
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
                machine_id: options.machine_id,
                registration_token: options.registration_token
            })
        ).data;
    }

    /**
     * Delete the current watcher from the LAPI.
     * Useful to cleanup an auto-registered watcher.
     * @since CrowdSec 1.6.9
     */
    public async deleteWatcher(): Promise<void> {
        this.requireCapability(LapiCapability.watcherSelfDelete);
        await this.http.delete<null, AxiosResponse<null>>('/v1/watchers/self');
    }

    /**
     * Delete a watcher from the LAPI using its credentials.
     * Useful to cleanup an auto-registered watcher without keeping a client instance.
     * @since CrowdSec 1.6.9
     * @param options - the machine credentials + connection options
     */
    public static async deleteWatcher(options: WatcherRegistrationRequest & IHTTPOptions): Promise<void> {
        const httpClient = CrowdSecClient.getHTTPClient({
            url: options.url,
            userAgent: options.userAgent,
            timeout: options.timeout,
            strictSSL: options.strictSSL
        });

        await httpClient.delete<null, AxiosResponse<null>>('/v1/watchers/self', {
            auth: {
                username: options.machine_id,
                password: options.password
            }
        });
    }

    public async stop() {
        this.stopped = true;
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = undefined;
        }
        if (this.autoRenewTimeout) {
            clearTimeout(this.autoRenewTimeout);
            this.autoRenewTimeout = undefined;
        }
    }
}
