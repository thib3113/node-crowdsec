import type { ICrowdSecClientOptions } from '../interfaces/index.js';
import { pkg } from '../pkg.js';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { createDebugger, getUrlRepresentation } from '../utils.js';
import { AxiosError } from '../Errors/AxiosError.js';
import { CrowdSecError } from '../Errors/CrowdSecError.js';
import { ConnectionTestError } from '../Errors/ConnectionTestError.js';
import { EErrorsCodes } from '../Errors/EErrorsCodes.js';

const debug = createDebugger('client');
const axiosDebug = createDebugger('axios');
const axiosDebugVerbose = axiosDebug.extend('verbose');

const defaultsOptions: Required<Omit<ICrowdSecClientOptions, 'url'>> = {
    timeout: 2000,
    userAgent: `${pkg.name}/v${pkg.version}`,
    strictSSL: true
};

export abstract class CrowdSecClient {
    private options: ICrowdSecClientOptions;

    protected static http: AxiosInstance;

    protected http: AxiosInstance;
    protected constructor(options: ICrowdSecClientOptions) {
        this.options = {
            ...defaultsOptions,
            ...options
        };

        const baseURL = this.options.url.endsWith('/') ? this.options.url.slice(0, -1) : this.options.url;

        this.http = this.addAxiosDebugInterceptors(
            axios.create({
                baseURL,
                timeout: this.options.timeout,
                httpsAgent: !this.options.strictSSL
                    ? new https.Agent({
                          rejectUnauthorized: false
                      })
                    : undefined,
                headers: { 'User-Agent': this.options.userAgent }
            })
        );
    }

    private addAxiosDebugInterceptors(instance: AxiosInstance): AxiosInstance {
        instance.interceptors.request.use((config) => {
            // @ts-ignore
            config.metadata = { startTime: new Date() };
            axiosDebug(`Starting Request on url ${config.method} ${getUrlRepresentation(config)}`);

            axiosDebugVerbose(`headers : %O`, config.headers);
            axiosDebugVerbose(`payload : %O`, config.data);
            return config;
        });

        instance.interceptors.response.use(
            (response) => {
                // @ts-ignore
                const duration = (new Date() - response?.config?.metadata?.startTime) / 1000 || null;
                const durationStr = duration ? ` in ${duration} seconds` : '';
                axiosDebug(
                    `Response from ${response?.config?.method} ${getUrlRepresentation(response?.config)} with code ${response?.status} ${
                        response?.statusText
                    }${durationStr}`
                );
                axiosDebugVerbose('headers : %O', response?.headers);
                axiosDebugVerbose(`headers sent : %O`, response?.request?._header);
                axiosDebugVerbose(`payload : %O `, response?.data);
                return response;
            },
            (error) => {
                if (error?.response) {
                    const rep = error.response;
                    axiosDebug(
                        `Response from ${rep.config?.method} ${getUrlRepresentation(rep.config)} with code ${rep.status} ${rep.statusText}`
                    );
                    axiosDebugVerbose(`headers : %O`, rep.headers);
                    axiosDebugVerbose(`payload : %O`, rep.data);
                } else {
                    if (error?.isAxiosError) {
                        axiosDebug(
                            `Response from ${error.config?.method} ${getUrlRepresentation(error.config)} with code ${error.code} ${
                                error.message
                            }`
                        );
                    }
                }

                return Promise.reject(error);
            }
        );

        //add error handler
        instance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error?.response?.config?.isRetry) {
                    return Promise.resolve();
                }
                if (error?.response) {
                    const message =
                        error.response.data?.message ||
                        error.response.data?.errors?.join('\n\n ----- \n\n') ||
                        error.response.statusText ||
                        'Unknown HTTP Error';
                    // axios error will remove circular dependency + format a little the sub error
                    error = new CrowdSecError(message, error.response.status, error.response?.data?.errors, new AxiosError(error));
                }

                return Promise.reject(error);
            }
        );

        return instance;
    }

    protected setAuthenticationHeaders(headers: Record<string, string>) {
        Object.entries(headers).forEach(([key, value]) => (this.http.defaults.headers[key] = value));
    }

    public abstract login(): Promise<void>;

    public abstract testConnection(): Promise<void>;

    protected async _testConnection(url: string): Promise<void> {
        const localDebug = debug.extend('testConnection');

        try {
            localDebug('call crowdsec');
            const result = await this.http.head(url, {
                validateStatus: () => true
            });

            localDebug('receive status %d from crowdsec', result.status);

            switch (result.status) {
                case 200:
                    localDebug('connection success');
                    return;
                case 403:
                    throw new ConnectionTestError('UNEXPECTED_KEY', EErrorsCodes.FORBIDDEN);
                default:
                    throw new ConnectionTestError('UNEXPECTED_STATUS_CODE', result.status);
            }
        } catch (e) {
            if (e instanceof ConnectionTestError) {
                throw e;
            }

            localDebug('Error : %o', e);
            if (axios.isAxiosError(e)) {
                throw new ConnectionTestError('HOST_NOT_REACHABLE', EErrorsCodes.UNKNOWN_ERROR);
            }
            throw new ConnectionTestError('UNKNOWN_ERROR');
        }
    }
}
