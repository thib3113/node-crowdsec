import type { ICrowdSecClientOptions, IHTTPOptions, ITLSAuthentication } from '../interfaces/index.js';
import { pkg } from '../pkg.js';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { createDebugger, getUrlRepresentation } from '../utils.js';
import { AxiosError, CrowdsecClientError, CrowdSecServerError, EErrorsCodes } from '../Errors/index.js';
import type { ErrorResponse } from '../types/index.js';
import {
    CapabilityContext,
    interpretProbe,
    toLapiCapability,
    type LapiCapability,
    type LapiCapabilityInput,
    type LapiCapabilityState,
    type LapiVersionEstimate
} from '../Capabilities.js';

const debug = createDebugger('client');
const axiosDebug = createDebugger('axios');
const axiosDebugVerbose = axiosDebug.extend('verbose');

const defaultsHTTPOptions: Required<Pick<ICrowdSecClientOptions, 'timeout' | 'userAgent' | 'strictSSL'>> = {
    timeout: 2000,
    userAgent: `node-${pkg.name}/v${pkg.version}`,
    strictSSL: true
};

const SENSITIVE_HEADERS = new Set(['authorization', 'x-api-key', 'x-crowdsec-api-key', 'x-crowdsec-token', 'cookie', 'set-cookie']);
const SENSITIVE_FIELDS = new Set(['password', 'token', 'registration_token', 'api_key', 'apikey']);

/**
 * Mask credentials before a debug log prints them. Debug output is opt-in, but
 * a login response or a passthrough header must never be written in clear.
 */
export function redactHeaders(headers: unknown): unknown {
    if (!headers || typeof headers !== 'object') {
        return headers;
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        redacted[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value;
    }
    return redacted;
}

export function redactBody(body: unknown, seen = new WeakSet<object>()): unknown {
    if (!body || typeof body !== 'object') {
        return body;
    }

    if (seen.has(body)) {
        return '[circular]';
    }
    seen.add(body);

    if (Array.isArray(body)) {
        return body.map((item) => redactBody(item, seen));
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        redacted[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '[redacted]' : redactBody(value, seen);
    }
    return redacted;
}

export abstract class CrowdSecClient {
    protected debug = debug;

    get http(): AxiosInstance {
        return this._http;
    }
    protected readonly options: ICrowdSecClientOptions;

    protected static http: AxiosInstance;

    private readonly _http: AxiosInstance;
    protected readonly capabilityContext: CapabilityContext;

    protected constructor(options: ICrowdSecClientOptions) {
        this.options = options;
        this._http = CrowdSecClient.getHTTPClient(this.options);
        this.capabilityContext = new CapabilityContext({
            version: options.lapiVersion,
            strict: options.strictCapabilities
        });
    }

    protected static getHTTPClient(options: IHTTPOptions): AxiosInstance {
        const axiosOptions = {
            ...defaultsHTTPOptions,
            ...options
        };

        if (!options?.url) {
            throw new CrowdsecClientError('options.url is needed to create a crowdsec client');
        }

        const baseURL = options.url.endsWith('/') ? options.url.slice(0, -1) : options.url;

        return this.addAxiosDebugInterceptors(
            axios.create({
                baseURL,
                timeout: axiosOptions.timeout,
                httpsAgent: !axiosOptions.strictSSL
                    ? new https.Agent({
                          rejectUnauthorized: false
                      })
                    : undefined,
                headers: { 'User-Agent': axiosOptions.userAgent }
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

    private static addAxiosDebugInterceptors(instance: AxiosInstance): AxiosInstance {
        instance.interceptors.request.use((config) => {
            // @ts-ignore
            config.metadata = { startTime: new Date() };
            axiosDebug(`Starting Request on url ${config.method} ${getUrlRepresentation(config)}`);

            axiosDebugVerbose(`headers : %O`, redactHeaders(config.headers));
            axiosDebugVerbose(`payload : %O`, redactBody(config.data));
            return config;
        });

        instance.interceptors.response.use(
            (response) => {
                // @ts-ignore
                const duration = (new Date() - response?.config?.metadata?.startTime) / 1000 || null;
                const durationStr = duration ? ` in ${duration} seconds` : '';
                axiosDebug(
                    `Response from ${response?.config?.method} ${getUrlRepresentation(
                        response?.config
                    )} with code ${response?.status} ${response?.statusText}${durationStr}`
                );
                axiosDebugVerbose('headers : %O', redactHeaders(response?.headers));
                axiosDebugVerbose('payload : %O', redactBody(response?.data));
                return response;
            },
            (error) => {
                if (error?.response) {
                    const rep = error.response;
                    axiosDebug(
                        `Response from ${rep.config?.method} ${getUrlRepresentation(rep.config)} with code ${rep.status} ${rep.statusText}`
                    );
                    axiosDebugVerbose(`headers : %O`, redactHeaders(rep.headers));
                    axiosDebugVerbose(`payload : %O`, redactBody(rep.data));
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
                if (error?.response) {
                    const message =
                        (error.response.data as ErrorResponse)?.message ??
                        (error.response.data as ErrorResponse)?.errors ??
                        error.response.statusText ??
                        'Unknown HTTP Error';
                    // axios error will remove circular dependency + format a little the sub error
                    error = new CrowdSecServerError(message, error.response.status, error.response?.data?.errors, new AxiosError(error));
                }

                throw error;
            }
        );

        return instance;
    }

    protected setAuthenticationHeaders(headers: Record<string, string>) {
        Object.entries(headers).forEach(([key, value]) => (this._http.defaults.headers[key] = value));
    }

    /**
     * Capabilities detected or declared for the connected LAPI.
     */
    public getCapabilities(): LapiCapabilityState {
        return this.capabilityContext.getCapabilities();
    }

    /**
     * Best guess of the connected LAPI version, derived from the capabilities
     * confirmed by probes. Exact only when `lapiVersion` was declared.
     *
     * @example { probable: '>=1.6.9 <1.7.7', minVersion: '1.6.9', belowVersion: '1.7.7' }
     */
    public getProbableVersion(): LapiVersionEstimate {
        return this.capabilityContext.getCapabilities().estimate;
    }

    /**
     * Whether a capability is supported. `undefined` means it is unknown.
     */
    public supports(capability: LapiCapabilityInput): boolean | undefined {
        return this.capabilityContext.supports(capability);
    }

    /**
     * Probe one capability and record the result.
     *
     * Returns the already-known value when the capability is resolved, unless
     * `force` is set. Returns `undefined` when no probe exists for it (for
     * example the 1.4.2 DELETE endpoints) or when the probe is inconclusive.
     *
     * The client must be authenticated first (call `login()`).
     */
    public async detectCapability(capability: LapiCapabilityInput, options: { force?: boolean } = {}): Promise<boolean | undefined> {
        const key = toLapiCapability(capability);

        const known = this.capabilityContext.supports(key);
        if (known !== undefined && !options.force) {
            return known;
        }

        const probes = await this.collectProbes();
        const probe = probes.find((entry) => entry.capability === key);
        if (!probe) {
            return known;
        }

        const status = await this.probeStatus(probe.request);
        const supported = interpretProbe(key, status);
        this.capabilityContext.applyProbes({ [key]: supported });
        return supported;
    }

    /**
     * Probe the connected LAPI to discover its capabilities.
     *
     * The client must be authenticated first (call `login()`). When
     * `lapiVersion` is declared, capabilities are already known and no request
     * is sent.
     */
    public async detectCapabilities(): Promise<LapiCapabilityState> {
        const current = this.getCapabilities();
        if (current.source === 'declared') {
            return current;
        }

        const probes = await this.collectProbes();
        const observed: Partial<Record<LapiCapability, boolean>> = {};

        await Promise.all(
            probes.map(async ({ capability, request }) => {
                const status = await this.probeStatus(request);
                const supported = interpretProbe(capability, status);
                if (supported !== undefined) {
                    observed[capability] = supported;
                }
            })
        );

        this.capabilityContext.applyProbes(observed);
        return this.getCapabilities();
    }

    protected requireCapability(capability: LapiCapabilityInput): void {
        this.capabilityContext.assertSupport(capability);
    }

    /**
     * Probes shared by bouncers and watchers. Each authentication mode adds the
     * endpoints it is allowed to reach: `/v1/decisions` is bouncer-only, while
     * a watcher probes `/v1/alerts` and the allowlist routes.
     */
    protected collectProbes(): Array<{ capability: LapiCapability; request: () => Promise<unknown> }> {
        return [];
    }

    private async probeStatus(request: () => Promise<unknown>): Promise<number | undefined> {
        try {
            const response = (await request()) as { status?: number } | undefined;
            return response?.status ?? 200;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                return error.response.status;
            }

            // The response interceptor wraps HTTP failures in CrowdSecServerError,
            // which keeps the status in `code`.
            const code = (error as { code?: unknown } | undefined)?.code;
            if (typeof code === 'number' && code >= 100 && code < 600) {
                return code;
            }

            return undefined;
        }
    }

    public abstract login(): Promise<void>;

    /**
     * stop the current client, and running processes
     */
    public abstract stop(): Promise<void>;

    public abstract testConnection(): Promise<void>;

    protected async _testConnection(url: string): Promise<void> {
        const localDebug = this.debug.extend('testConnection');

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
