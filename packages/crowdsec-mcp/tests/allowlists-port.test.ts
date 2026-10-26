import { describe, it, expect, vi } from 'vitest';
import { createAllowlistsPort, unavailableAllowlistsPort } from '../src/allowlists-port.js';
import type { WatcherClient } from 'crowdsec-client';

function makeFakeWatcher() {
    return {
        Allowlists: {
            list: vi.fn().mockResolvedValue([{ name: 'test-list' }]),
            get: vi.fn().mockResolvedValue({ name: 'test-list', items: [] }),
            check: vi.fn().mockResolvedValue({ allowlisted: true, reason: 'match' }),
            bulkCheck: vi.fn().mockResolvedValue({ results: [] })
        }
    } as unknown as WatcherClient;
}

describe('createAllowlistsPort', () => {
    it('should delegate list to watcher.Allowlists.list', async () => {
        const watcher = makeFakeWatcher();
        const port = createAllowlistsPort(watcher);

        const result = await port.list();

        expect(watcher.Allowlists.list).toHaveBeenCalled();
        expect(result).toEqual([{ name: 'test-list' }]);
    });

    it('should delegate get to watcher.Allowlists.get', async () => {
        const watcher = makeFakeWatcher();
        const port = createAllowlistsPort(watcher);

        const result = await port.get('my-list', false);

        expect(watcher.Allowlists.get).toHaveBeenCalledWith('my-list', false);
        expect(result).toEqual({ name: 'test-list', items: [] });
    });

    it('should delegate check to watcher.Allowlists.check', async () => {
        const watcher = makeFakeWatcher();
        const port = createAllowlistsPort(watcher);

        const result = await port.check('1.2.3.4');

        expect(watcher.Allowlists.check).toHaveBeenCalledWith('1.2.3.4');
        expect(result).toEqual({ allowlisted: true, reason: 'match' });
    });

    it('should delegate bulkCheck to watcher.Allowlists.bulkCheck', async () => {
        const watcher = makeFakeWatcher();
        const port = createAllowlistsPort(watcher);

        const result = await port.bulkCheck(['1.2.3.4', '5.6.7.8']);

        expect(watcher.Allowlists.bulkCheck).toHaveBeenCalledWith(['1.2.3.4', '5.6.7.8']);
        expect(result).toEqual({ results: [] });
    });
});

describe('unavailableAllowlistsPort', () => {
    it('should throw on list', async () => {
        const port = unavailableAllowlistsPort();
        await expect(port.list()).rejects.toThrow('allowlists are not available in bouncer mode');
    });

    it('should throw on get', async () => {
        const port = unavailableAllowlistsPort();
        await expect(port.get('x')).rejects.toThrow('allowlists are not available in bouncer mode');
    });

    it('should throw on check', async () => {
        const port = unavailableAllowlistsPort();
        await expect(port.check('1.2.3.4')).rejects.toThrow('allowlists are not available in bouncer mode');
    });

    it('should throw on bulkCheck', async () => {
        const port = unavailableAllowlistsPort();
        await expect(port.bulkCheck(['1.2.3.4'])).rejects.toThrow('allowlists are not available in bouncer mode');
    });
});
