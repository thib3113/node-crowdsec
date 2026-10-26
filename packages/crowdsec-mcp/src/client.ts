import { readFile } from 'node:fs/promises';
import { BouncerClient, WatcherClient } from 'crowdsec-client';
import type { Config } from './config.js';
import type { AppContext } from './types.js';
import { createAllowlistsPort, unavailableAllowlistsPort } from './allowlists-port.js';

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
        if (!loginPromise) {
            loginPromise = (watcher ?? bouncer)!.login();
        }

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
