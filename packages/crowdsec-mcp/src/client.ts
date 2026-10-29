import { readFile } from 'node:fs/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { BouncerClient, CrowdsecClientError, WatcherClient } from 'crowdsec-client';
import type { Config } from './config.js';
import type { AppContext } from './types.js';
import { createAllowlistsPort, unavailableAllowlistsPort } from './allowlists-port.js';
import { HttpRequestError } from './http-error.js';

interface TokenWatcherClientOptions {
    url: string;
    token: string;
    strictSSL?: boolean;
    timeout?: number;
}

function isAuthenticationFailure(error: unknown): boolean {
    // CrowdSec answers 403 for an invalid key/token and 401 for a missing one.
    // The client wraps 403 as UNEXPECTED_KEY and any other status as
    // UNEXPECTED_STATUS_CODE, so the status has to be read from the cause.
    // Anything else (DNS, timeout, TLS, 5xx) must keep its original message.
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

export type PassthroughAuth = { mode: 'bouncer'; apiKey: string } | { mode: 'watcher'; token: string };

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
}

export function resolvePassthroughAuth(headers: IncomingHttpHeaders): PassthroughAuth {
    const apiKey = headerValue(headers, 'x-crowdsec-api-key')?.trim();
    const token = headerValue(headers, 'x-crowdsec-token')?.trim();

    if (apiKey && token) {
        throw new HttpRequestError(400, -32602, 'Provide either X-CrowdSec-Api-Key or X-CrowdSec-Token, not both');
    }
    if (apiKey) {
        return { mode: 'bouncer', apiKey };
    }
    if (token) {
        return { mode: 'watcher', token };
    }

    throw new HttpRequestError(401, -32001, 'Missing X-CrowdSec-Api-Key or X-CrowdSec-Token');
}

async function loadTls(config: Config) {
    if (!config.tls) {
        return undefined;
    }

    const [cert, key, ca] = await Promise.all([readFile(config.tls.cert), readFile(config.tls.key), readFile(config.tls.ca)]);

    return { cert, key, ca };
}

export async function createContext(config: Config): Promise<AppContext> {
    const tls = await loadTls(config);

    let watcher: WatcherClient | undefined;
    let bouncer: BouncerClient | undefined;

    if (config.auth === 'bouncer') {
        bouncer = new BouncerClient({
            url: config.url,
            auth: tls ?? { apiKey: config.apiKey! },
            strictSSL: config.strictSSL,
            timeout: config.timeout
        });
    } else {
        watcher = new WatcherClient({
            url: config.url,
            auth: tls ?? {
                machineID: config.machineId!,
                password: config.password!,
                autoRenew: true
            },
            strictSSL: config.strictSSL,
            timeout: config.timeout,
            heartbeat: false
        });
    }

    let loginPromise: Promise<void> | undefined;

    const ensureReady = async (): Promise<void> => {
        loginPromise ??= (watcher ?? bouncer)!.login();

        try {
            await loginPromise;
        } catch (error) {
            loginPromise = undefined;
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
        await (watcher ?? bouncer)?.stop();
    };

    return {
        mode: config.auth,
        capabilities: {
            read: true,
            write: config.auth === 'watcher',
            allowlists: config.auth === 'watcher'
        },
        watcher,
        bouncer,
        allowlists: watcher ? createAllowlistsPort(watcher) : unavailableAllowlistsPort(),
        config,
        ensureReady,
        stop
    };
}

export function createPassthroughContext(config: Config, headers: IncomingHttpHeaders): AppContext {
    const auth = resolvePassthroughAuth(headers);

    if (auth.mode === 'bouncer') {
        const bouncer = new BouncerClient({
            url: config.url,
            auth: { apiKey: auth.apiKey },
            strictSSL: config.strictSSL,
            timeout: config.timeout
        });

        let loginPromise: Promise<void> | undefined;
        const ensureReady = async (): Promise<void> => {
            loginPromise ??= bouncer.login();

            try {
                await loginPromise;
            } catch (error) {
                loginPromise = undefined;
                if (isAuthenticationFailure(error)) {
                    throw new Error('Invalid CrowdSec API key');
                }
                throw error;
            }
        };

        return {
            mode: 'bouncer',
            capabilities: {
                read: true,
                write: false,
                allowlists: false
            },
            bouncer,
            allowlists: unavailableAllowlistsPort(),
            config,
            ensureReady,
            stop: () => bouncer.stop()
        };
    }

    const watcher = new TokenWatcherClient({
        url: config.url,
        token: auth.token,
        strictSSL: config.strictSSL,
        timeout: config.timeout
    });

    let loginPromise: Promise<void> | undefined;
    const ensureReady = async (): Promise<void> => {
        loginPromise ??= watcher.login();

        try {
            await loginPromise;
        } catch (error) {
            loginPromise = undefined;
            throw error;
        }
    };

    return {
        mode: 'watcher',
        capabilities: {
            read: true,
            write: true,
            allowlists: true
        },
        watcher,
        allowlists: createAllowlistsPort(watcher),
        config,
        ensureReady,
        stop: () => watcher.stop()
    };
}
