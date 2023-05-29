import { CrowdSecClient } from './CrowdSecClient.js';
import { createDebugger } from '../utils.js';
import { IWatcherClientOptions } from '../interfaces/index.js';
import { AxiosResponse } from 'axios';
import type { WatcherAuthRequest, WatcherAuthResponse, WatcherRegistrationRequest } from '../types/index.js';
import { DecisionsWatcher } from '../Decisions/DecisionsWatcher.js';
import { Alerts } from '../Alerts/Alerts.js';

const debug = createDebugger('WatcherClient');

export class WatcherClient extends CrowdSecClient {
    private autoRenewTimeout?: NodeJS.Timeout;

    private auth: IWatcherClientOptions['auth'];

    public Decisions: DecisionsWatcher;
    public Alerts: Alerts;

    constructor(options: IWatcherClientOptions) {
        super(options);

        this.auth = {
            autoRenew: true,
            ...options.auth
        };

        this.Decisions = new DecisionsWatcher({ httpClient: this.http });
        this.Alerts = new Alerts({ httpClient: this.http });
    }

    private async _login() {
        const localDebug = debug.extend('_login');
        localDebug('start _login');
        if (this.autoRenewTimeout) {
            clearTimeout(this.autoRenewTimeout);
        }

        try {
            const res = (
                await this.http.post<WatcherAuthResponse, AxiosResponse<WatcherAuthResponse>, WatcherAuthRequest>('/v1/watchers/login', {
                    machine_id: this.auth.machineID,
                    password: this.auth.password
                })
            ).data;

            if (!res.token || !res.expire) {
                //TODO
                throw new Error('fail to get token');
            }

            this.setAuthenticationHeaders({
                Authorization: `Bearer ${res.token}`
            });

            if (this.auth.autoRenew) {
                // 5m
                const renewTimeBeforeEnd = 5 * 60 * 1000;
                const renewInTime = new Date(res.expire).getTime() - renewTimeBeforeEnd - Date.now();

                localDebug('next token renew planned at %o', new Date(Date.now() + renewInTime));
                this.autoRenewTimeout = setTimeout(() => {
                    this._login();
                }, renewInTime);
            }
        } catch (e) {
            localDebug('fail to get token');
            throw e;
        }
    }

    async login(): Promise<void> {
        await this._login();
        return this.testConnection();
    }

    public async testConnection(): Promise<void> {
        return this._testConnection('/v1/alerts');
    }

    /**
     * Allow to register a watcher on CLAPI
     * you need to validate on the local machine
     * @param options
     */
    public async registerWatcher(options: WatcherRegistrationRequest) {
        return (await this.http.post<null, AxiosResponse<null>, WatcherRegistrationRequest>('/v1/watchers', options)).data;
    }
}
