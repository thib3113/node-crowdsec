import type { ICrowdSecClientOptions, ITLSAuthentication } from '../interfaces/index.js';
import { pkg } from '../pkg.js';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { createDebugger, getUrlRepresentation } from '../utils.js';
import { AxiosError, CrowdsecClientError, CrowdSecServerError, EErrorsCodes } from '../Errors/index.js';
import type { ErrorResponse } from '../types/index.js';

const debug = createDebugger('client');
const axiosDebug = createDebugger('axios');
const axiosDebugVerbose = axiosDebug.extend('verbose');

const defaultsOptions: Required<Omit<ICrowdSecClientOptions, 'url'>> = {
    timeout: 2000,
    userAgent: `node-${pkg.name}/v${pkg.version}`,
    strictSSL: true
};

export abstract class CrowdSecClient {
    get http(): AxiosInstance {
        return this._http;
    }
    private options: ICrowdSecClientOptions;

    protected static http: AxiosInstance;

    private readonly _http: AxiosInstance;
    protected constructor(options: ICrowdSecClientOptions) {
        this.options = {
            ...defaultsOptions,
            ...options
        };

        const baseURL = this.options.url.endsWith('/') ? this.options.url.slice(0, -1) : this.options.url;

        this._http = this.addAxiosDebugInterceptors(
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

    protected setAuthenticationByTLS(auth: ITLSAuthentication) {
        this.http.defaults.httpsAgent = new https.Agent({
            cert: auth.cert,
            key: auth.key,
            ca: auth.ca,
            rejectUnauthorized: this.options.strictSSL ?? true
        });
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

                throw error;
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
                        (error.response.data as ErrorResponse)?.message ??
                        (error.response.data as ErrorResponse)?.errors ??
                        error.response.statusText ??
                        'Unknown HTTP Error';
                    // axios error will remove circular dependency + format a little the sub error
                    error = new CrowdSecServerError(message, error.response.status, error.response?.data?.errors, new AxiosError(error));
                }

                return Promise.reject(error);
            }
        );

        return instance;
    }

    protected setAuthenticationHeaders(headers: Record<string, string>) {
        Object.entries(headers).forEach(([key, value]) => (this._http.defaults.headers[key] = value));
    }

    public abstract login(): Promise<void>;

    /**
     * stop the current client, and running processes
     */
    public abstract stop(): Promise<void>;

    public abstract testConnection(): Promise<void>;

    protected async _testConnection(url: string): Promise<void> {
        const localDebug = debug.extend('testConnection');

        try {
            localDebug('call crowdsec');
            const result = await this._http.head(url, {
                validateStatus: () => true
            });

            localDebug('receive status %d from crowdsec', result.status);

            switch (result.status) {
                case 200:
                    localDebug('connection success');
                    return;
                case 403:
                    throw new CrowdsecClientError(
                        'UNEXPECTED_KEY',
                        EErrorsCodes.CONNECTION_TEST_FAILED,
                        new Error('Crowdsec answer with code 403')
                    );
                default:
                    throw new CrowdsecClientError(
                        'UNEXPECTED_STATUS_CODE',
                        EErrorsCodes.CONNECTION_TEST_FAILED,
                        new Error(`Crowdsec answer with (${result.status}) ${result.statusText}`)
                    );
            }
        } catch (e) {
            if (e instanceof CrowdsecClientError) {
                throw e;
            }

            localDebug('Error : %o', e);
            if (axios.isAxiosError(e)) {
                throw new CrowdsecClientError('HOST_NOT_REACHABLE', EErrorsCodes.CONNECTION_TEST_FAILED, e);
            }
            throw new CrowdsecClientError('UNKNOWN_ERROR', undefined, e instanceof Error ? e : undefined);
        }
    }
}
