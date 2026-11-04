import { readFile } from 'node:fs/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { BouncerClient, CrowdsecClientError, WatcherClient } from 'crowdsec-client';
import type { Config } from './config.js';
import type { AppContext, ClientReadiness, ReadinessRequirement } from './types.js';
import { createAllowlistsPort, unavailableAllowlistsPort } from './allowlists-port.js';
import { HttpRequestError } from './http-error.js';

interface TokenWatcherClientOptions {
    url: string;
    token: string;
    lapiVersion?: string;
    strictSSL?: boolean;
    timeout?: number;
}

function isAuthenticationFailure(error: unknown): boolean {
    // CrowdSec answers 403 for an invalid key/token and 401 for a missing one.
    // Login/connection failures are wrapped as CrowdSecServerError, which
    // carries the HTTP status in `code` but is not a CrowdsecClientError
    // subclass; other paths use UNEXPECTED_KEY / UNEXPECTED_STATUS_CODE.
    // Anything else (DNS, timeout, TLS, 5xx) must keep its original message.
    const code = (error as { code?: unknown } | undefined)?.code;
    if (code === 401 || code === 403) {
        return true;
    }
    if (!(error instanceof CrowdsecClientError)) {
        return false;
    }
    if (error.message === 'UNEXPECTED_KEY') {
        return true;
    }
    return error.message === 'UNEXPECTED_STATUS_CODE' && /\b(401|403)\b/.test(error.exception?.message ?? '');
}

class TokenWatcherClient extends WatcherClient {
    public constructor(options: TokenWatcherClientOptions) {
        super({
            url: options.url,
            lapiVersion: options.lapiVersion,
            auth: {
                machineID: 'passthrough',
                password: 'passthrough'
            },
            strictSSL: options.strictSSL,
            timeout: options.timeout,
            heartbeat: false
        });

        this.setAuthenticationHeaders({
            Authorization: `Bearer ${options.token}`
        });
    }

    public override async login(): Promise<void> {
        try {
            await this.testConnection();
        } catch (error) {
            if (isAuthenticationFailure(error)) {
                throw new Error('Invalid CrowdSec token');
            }
            throw error;
        }
    }
}

export interface PassthroughAuth {
    apiKey?: string;
    token?: string;
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
}

export function resolvePassthroughAuth(headers: IncomingHttpHeaders): PassthroughAuth {
    const apiKey = headerValue(headers, 'x-crowdsec-api-key')?.trim();
    const token = headerValue(headers, 'x-crowdsec-token')?.trim();

    if (!apiKey && !token) {
        throw new HttpRequestError(401, -32001, 'Missing X-CrowdSec-Api-Key or X-CrowdSec-Token');
    }

    // Both headers on the same request enable the fast decision path and the
    // richer watcher tools at once, mirroring static dual credentials.
    return { ...(apiKey ? { apiKey } : {}), ...(token ? { token } : {}) };
}

async function loadTls(config: Config) {
    if (!config.tls) {
        return undefined;
    }

    const [cert, key, ca] = await Promise.all([readFile(config.tls.cert), readFile(config.tls.key), readFile(config.tls.ca)]);

    return { cert, key, ca };
}

function buildCapabilities(watcher: WatcherClient | undefined, bouncer: BouncerClient | undefined): AppContext['capabilities'] {
    return {
        read: true,
        alerts: watcher !== undefined,
        decisions: watcher !== undefined || bouncer !== undefined,
        decisionsFast: bouncer !== undefined,
        write: watcher !== undefined,
        allowlists: watcher !== undefined
    };
}

function createReadiness(
    watcher: WatcherClient | undefined,
    bouncer: BouncerClient | undefined,
    readiness: ClientReadiness,
    mapError?: (error: unknown) => unknown
): (requirement?: ReadinessRequirement) => Promise<void> {
    // Login lazily and once per client. A watcher-only tool must not fail
    // because the bouncer key is invalid, and vice versa.
    const loginPromises = new WeakMap<WatcherClient | BouncerClient, Promise<void>>();
    const loginOnce = async (client: WatcherClient | BouncerClient): Promise<void> => {
        const key = client === watcher ? 'watcher' : 'bouncer';
        let promise = loginPromises.get(client);
        if (!promise) {
            promise = client.login();
            loginPromises.set(client, promise);
        }

        try {
            await promise;
            readiness[key] = 'ok';
        } catch (error) {
            loginPromises.delete(client);
            readiness[key] = 'error';
            throw mapError ? mapError(error) : error;
        }
    };

    return async (requirement: ReadinessRequirement = 'any'): Promise<void> => {
        if (requirement === 'none') {
            return;
        }

        if (requirement === 'watcher') {
            if (!watcher) {
                throw new Error('Watcher credentials are not configured');
            }
            await loginOnce(watcher);
            return;
        }

        if (requirement === 'bouncer') {
            if (!bouncer) {
                throw new Error('Bouncer credentials are not configured');
            }
            await loginOnce(bouncer);
            return;
        }

        // `any` is used by crowdsec_status: prefer the bouncer (cheaper), fall
        // back to the watcher, and succeed as soon as one credential works.
        let lastError: unknown;
        if (bouncer) {
            try {
                await loginOnce(bouncer);
                return;
            } catch (error) {
                lastError = error;
            }
        }
        if (watcher) {
            try {
                await loginOnce(watcher);
                return;
            } catch (error) {
                lastError = error;
            }
        }

        if (lastError) {
            throw lastError;
        }
        throw new Error('No CrowdSec credentials are configured');
    };
}

function createAuthErrorMapper(watcher: WatcherClient | undefined, bouncer: BouncerClient | undefined): (error: unknown) => unknown {
    return (error) => {
        if (!isAuthenticationFailure(error)) {
            return error;
        }
        if (watcher && bouncer) {
            return new Error('Invalid CrowdSec credentials');
        }
        return new Error(watcher ? 'Invalid CrowdSec token' : 'Invalid CrowdSec API key');
    };
}

function stopClients(watcher: WatcherClient | undefined, bouncer: BouncerClient | undefined): Promise<void> {
    return Promise.all([watcher?.stop(), bouncer?.stop()]).then(() => undefined);
}

export async function createContext(config: Config): Promise<AppContext> {
    // Only read the certificate files when a configured client actually needs
    // them: an explicit machine pair or API key takes precedence, so unreadable
    // TLS files must not break an otherwise valid configuration.
    const needsTls = (config.watcher && !(config.machineId && config.password)) || (config.bouncer && !config.apiKey);
    const tls = needsTls ? await loadTls(config) : undefined;

    // Credentials are selected per client: an explicit machine pair/API key
    // always wins over the ambiguous TLS certificate.
    const watcher = config.watcher
        ? new WatcherClient({
              url: config.url,
              lapiVersion: config.lapiVersion,
              auth:
                  config.machineId && config.password
                      ? {
                            machineID: config.machineId,
                            password: config.password,
                            autoRenew: true
                        }
                      : (tls ?? { machineID: config.machineId!, password: config.password!, autoRenew: true }),
              strictSSL: config.strictSSL,
              timeout: config.timeout,
              heartbeat: false
          })
        : undefined;

    const bouncer = config.bouncer
        ? new BouncerClient({
              url: config.url,
              lapiVersion: config.lapiVersion,
              auth: config.apiKey ? { apiKey: config.apiKey } : (tls ?? { apiKey: config.apiKey! }),
              strictSSL: config.strictSSL,
              timeout: config.timeout
          })
        : undefined;

    const readiness: ClientReadiness = {};

    return {
        mode: config.auth,
        capabilities: buildCapabilities(watcher, bouncer),
        watcher,
        bouncer,
        allowlists: watcher ? createAllowlistsPort(watcher) : unavailableAllowlistsPort(),
        config,
        readiness,
        ensureReady: createReadiness(watcher, bouncer, readiness, createAuthErrorMapper(watcher, bouncer)),
        stop: () => stopClients(watcher, bouncer)
    };
}

export function createPassthroughContext(config: Config, headers: IncomingHttpHeaders): AppContext {
    const auth = resolvePassthroughAuth(headers);

    const bouncer = auth.apiKey
        ? new BouncerClient({
              url: config.url,
              lapiVersion: config.lapiVersion,
              auth: { apiKey: auth.apiKey },
              strictSSL: config.strictSSL,
              timeout: config.timeout
          })
        : undefined;

    const watcher = auth.token
        ? new TokenWatcherClient({
              url: config.url,
              lapiVersion: config.lapiVersion,
              token: auth.token,
              strictSSL: config.strictSSL,
              timeout: config.timeout
          })
        : undefined;

    const readiness: ClientReadiness = {};
    const ensureReady = createReadiness(watcher, bouncer, readiness, createAuthErrorMapper(watcher, bouncer));

    return {
        mode: watcher ? 'watcher' : 'bouncer',
        capabilities: buildCapabilities(watcher, bouncer),
        watcher,
        bouncer,
        allowlists: watcher ? createAllowlistsPort(watcher) : unavailableAllowlistsPort(),
        config,
        readiness,
        ensureReady,
        stop: () => stopClients(watcher, bouncer)
    };
}
