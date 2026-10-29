import type { WatcherClient } from 'crowdsec-client';
import type { AllowlistsPort } from './types.js';

const unavailable = (): Promise<never> => Promise.reject(new Error('allowlists are not available in bouncer mode'));

export function createAllowlistsPort(watcher: WatcherClient): AllowlistsPort {
    return {
        list: () => watcher.Allowlists.list(),
        get: (name, withContent) => watcher.Allowlists.get(name, withContent),
        check: (value) => watcher.Allowlists.check(value),
        bulkCheck: (targets) => watcher.Allowlists.bulkCheck(targets)
    };
}

export function unavailableAllowlistsPort(): AllowlistsPort {
    return {
        list: unavailable,
        get: unavailable,
        check: unavailable,
        bulkCheck: unavailable
    };
}
