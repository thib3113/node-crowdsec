import { describe, it, afterEach, beforeEach, expect, vi } from 'vitest';

import type { Allowlists } from '../../src/index.js';

vi.mock('../../src/BaseSubObject.js', () => ({ BaseSubObject: vi.fn() }));

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
});
