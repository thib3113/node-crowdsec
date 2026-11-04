import { describe, it, afterEach, beforeEach, expect, vi } from 'vitest';

import { FeatureNotSupportedError } from '../../src/index.js';
import type { Allowlists } from '../../src/index.js';

vi.mock('../../src/BaseSubObject.js', () => ({
    BaseSubObject: class {
        requireCapability = vi.fn();
    }
}));

describe('Allowlists', () => {
    const httpGetMock = vi.fn();
    const httpPostMock = vi.fn();
    let allowlists: Allowlists;
    beforeEach(async () => {
        const res = await import('../../src/Allowlists/Allowlists.js');
        // @ts-ignore
        allowlists = new res.Allowlists();
        // @ts-ignore
        allowlists.http = { get: httpGetMock, post: httpPostMock };
    });
    afterEach(() => {
        httpGetMock.mockReset();
        httpPostMock.mockReset();
    });

    it('should list allowlists with content by default', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.list()).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists', {
            params: { with_content: true }
        });
    });

    it('should list allowlists without content', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.list(false)).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists', {
            params: { with_content: false }
        });
    });

    it('should get an allowlist by name with content', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.get('my-list')).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists/my-list', {
            params: { with_content: true }
        });
    });

    it('should get an allowlist by name without content', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.get('my-list', false)).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists/my-list', {
            params: { with_content: false }
        });
    });

    it('should encode allowlist name', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.get('list with spaces')).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists/list%20with%20spaces', {
            params: { with_content: true }
        });
    });

    it('should check a value', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.check('1.2.3.4')).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists/check/1.2.3.4');
    });

    it('should encode check value', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.check('10.0.0.0/8')).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists/check/10.0.0.0%2F8');
    });

    it('should bulk check targets', async () => {
        httpPostMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await allowlists.bulkCheck(['1.2.3.4', '5.6.7.8'])).toBe('test');

        expect(httpPostMock).toHaveBeenCalledWith('/v1/allowlists/check', {
            targets: ['1.2.3.4', '5.6.7.8']
        });
    });

    it('should fall back to per-value checks when the bulk capability is known to be absent', async () => {
        (allowlists as unknown as { capabilities: unknown }).capabilities = { supports: () => false, learn: vi.fn() };
        httpGetMock.mockImplementation((url: string) =>
            Promise.resolve({
                data: url === '/v1/allowlists/check/1.2.3.4' ? { allowlisted: true, reason: 'my-list/1.2.3.4' } : { allowlisted: false }
            })
        );

        const result = await allowlists.bulkCheck(['1.2.3.4', '5.6.7.8']);

        expect(result).toEqual({ results: [{ target: '1.2.3.4', allowlists: ['unknown allowlist (matched item: my-list/1.2.3.4)'] }] });
        expect(httpPostMock).not.toHaveBeenCalled();
    });

    it('should use the target when the single check has no reason', async () => {
        (allowlists as unknown as { capabilities: unknown }).capabilities = { supports: () => false, learn: vi.fn() };
        httpGetMock.mockResolvedValue({ data: { allowlisted: true } });

        const result = await allowlists.bulkCheck(['1.2.3.4']);

        expect(result).toEqual({ results: [{ target: '1.2.3.4', allowlists: ['unknown allowlist (matched item: 1.2.3.4)'] }] });
    });

    it('should fall back when the bulk route answers 405 (LAPI 1.6.6-1.6.8)', async () => {
        const learn = vi.fn();
        (allowlists as unknown as { capabilities: unknown }).capabilities = { supports: () => undefined, learn };
        httpPostMock.mockRejectedValueOnce({ code: 405 });
        httpGetMock.mockResolvedValue({ data: { allowlisted: true, reason: 'my-list/1.2.3.4' } });

        const result = await allowlists.bulkCheck(['1.2.3.4']);

        expect(result.results).toEqual([{ target: '1.2.3.4', allowlists: ['unknown allowlist (matched item: my-list/1.2.3.4)'] }]);
        expect(learn).toHaveBeenCalledWith('allowlistsBulkCheck', false);
    });

    it('should fall back on a raw Axios 404', async () => {
        httpPostMock.mockRejectedValueOnce({ code: 'ERR_BAD_REQUEST', response: { status: 404 } });
        httpGetMock.mockResolvedValue({ data: { allowlisted: true, reason: 'my-list/1.2.3.4' } });

        const result = await allowlists.bulkCheck(['1.2.3.4']);

        expect(result.results).toEqual([{ target: '1.2.3.4', allowlists: ['unknown allowlist (matched item: my-list/1.2.3.4)'] }]);
        expect(httpGetMock).toHaveBeenCalledWith('/v1/allowlists/check/1.2.3.4');
    });

    it('should raise a typed error when the per-value route is also missing', async () => {
        httpPostMock.mockRejectedValueOnce({ code: 405 });
        httpGetMock.mockRejectedValueOnce({ code: 404 });

        await expect(allowlists.bulkCheck(['1.2.3.4'])).rejects.toBeInstanceOf(FeatureNotSupportedError);
    });
});
