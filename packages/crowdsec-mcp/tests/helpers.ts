import type { Config } from '../src/config.js';
import type { AppContext } from '../src/types.js';

export function makeConfig(overrides: Partial<Config> = {}): Config {
    return {
        url: 'http://127.0.0.1:8080',
        auth: 'watcher',
        machineId: 'machine',
        password: 'password',
        strictSSL: true,
        timeout: 10000,
        transport: 'stdio',
        http: {
            host: '127.0.0.1',
            port: 3939,
            token: 'token'
        },
        readonly: true,
        disableTools: [],
        maxResults: 25,
        maxBanDuration: '24h',
        maxBanDurationSeconds: 86400,
        ...overrides
    };
}

export function makeContext(overrides: Partial<AppContext> = {}): AppContext {
    let readyCalls = 0;
    const context: AppContext = {
        mode: 'watcher',
        capabilities: {
            read: true,
            write: true,
            allowlists: true
        },
        allowlists: {
            list: async () => [],
            get: async () => ({}),
            check: async () => ({ allowlisted: false }),
            bulkCheck: async () => ({ results: [] })
        },
        config: makeConfig(),
        ensureReady: async () => {
            readyCalls++;
        },
        stop: async () => undefined,
        ...overrides
    };

    Object.defineProperty(context, 'readyCalls', {
        get: () => readyCalls,
        enumerable: false
    });

    return context;
}
