import { describe, it, afterEach, beforeEach, expect, vi } from 'vitest';

import { CapabilityContext, LapiCapability } from '../../src/Capabilities.js';
import type { Decisions } from '../../src/types/index.js';
import type { DecisionsWatcher } from '../../src/index.js';

vi.mock('../../src/BaseSubObject.js', () => ({
    BaseSubObject: class {
        requireCapability = vi.fn();
    }
}));

describe('DecisionsWatcher', () => {
    const httpDeleteMock = vi.fn();
    let watcher: DecisionsWatcher;
    beforeEach(async () => {
        const res = await import('../../src/Decisions/DecisionsWatcher.js');
        // @ts-ignore
        watcher = new res.DecisionsWatcher();
        // @ts-ignore
        watcher.http = { delete: httpDeleteMock };
    });
    afterEach(() => {
        httpDeleteMock.mockReset();
    });
    it('should call delete with id', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await watcher.deleteById('123')).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions/123');
    });

    it('should encode the id segment', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        await watcher.deleteById('1/../watchers/self');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions/1%2F..%2Fwatchers%2Fself');
    });

    it('should call delete with options', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));
        const deleteOptions: Decisions.DeleteDecisions.RequestQuery = {
            ip: '1.2.3.4'
        };

        expect(await watcher.delete(deleteOptions)).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions', { params: { ...deleteOptions, contains: false } });
        // @ts-ignore
        expect(watcher.requireCapability).toHaveBeenCalledWith(LapiCapability.containsFilter);
    });

    it('should keep an explicit contains value on an ip delete', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        await watcher.delete({ ip: '1.2.3.4', contains: true });

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions', { params: { ip: '1.2.3.4', contains: true } });
    });

    it('should retry with scope on a raw Axios 500', async () => {
        httpDeleteMock.mockRejectedValueOnce(
            Object.assign(new Error("'scopes' doesn't exist: invalid filter"), {
                code: 'ERR_BAD_RESPONSE',
                response: { status: 500 }
            })
        );
        httpDeleteMock.mockResolvedValueOnce({ data: 'test' });

        expect(await watcher.delete({ scopes: 'Country', value: 'FR' })).toBe('test');

        expect(httpDeleteMock).toHaveBeenNthCalledWith(1, '/v1/decisions', { params: { scopes: 'Country', value: 'FR' } });
        expect(httpDeleteMock).toHaveBeenNthCalledWith(2, '/v1/decisions', { params: { scope: 'Country', value: 'FR' } });
    });

    it('should require the contains capability when deleting with contains', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        await watcher.delete({ contains: false });

        expect((watcher as unknown as { requireCapability: ReturnType<typeof vi.fn> }).requireCapability).toHaveBeenCalledWith(
            'containsFilter'
        );
    });

    it('should use scope when the capability is known unsupported', async () => {
        const supports = vi.fn().mockReturnValue(false);
        const learn = vi.fn();
        // @ts-ignore
        watcher.capabilities = { supports, learn };
        httpDeleteMock.mockResolvedValueOnce({ data: { nbDeleted: '1' } });

        await watcher.delete({ scopes: 'Country', value: 'FR' });

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions', {
            params: { value: 'FR', scope: 'Country' }
        });
        expect(learn).toHaveBeenCalledWith('decisionScopesDelete', false);
    });

    it('should use scopes when the capability is known supported', async () => {
        const supports = vi.fn().mockReturnValue(true);
        const learn = vi.fn();
        // @ts-ignore
        watcher.capabilities = { supports, learn };
        httpDeleteMock.mockResolvedValueOnce({ data: { nbDeleted: '1' } });

        await watcher.delete({ scopes: 'Country', value: 'FR' });

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions', {
            params: { value: 'FR', scopes: 'Country' }
        });
        expect(learn).toHaveBeenCalledWith('decisionScopesDelete', true);
    });

    it('should retry with scope when scopes is rejected and the capability is unknown', async () => {
        const supports = vi.fn().mockReturnValue(undefined);
        const learn = vi.fn();
        // @ts-ignore
        watcher.capabilities = { supports, learn };
        const error = Object.assign(new Error("'scopes' doesn't exist: invalid filter"), { code: 500 });
        httpDeleteMock.mockRejectedValueOnce(error).mockResolvedValueOnce({ data: { nbDeleted: '1' } });

        await watcher.delete({ scopes: 'Country', value: 'FR' });

        expect(httpDeleteMock).toHaveBeenCalledTimes(2);
        expect(httpDeleteMock.mock.calls[0][1].params).toMatchObject({ scopes: 'Country', value: 'FR' });
        expect(httpDeleteMock.mock.calls[1][1].params).toMatchObject({ scope: 'Country', value: 'FR' });
        expect(learn).toHaveBeenCalledWith('decisionScopesDelete', false);
    });

    it('should retry with scopes when scope is rejected', async () => {
        const supports = vi.fn().mockReturnValue(false);
        const learn = vi.fn();
        // @ts-ignore
        watcher.capabilities = { supports, learn };
        const error = Object.assign(new Error("'scope' doesn't exist: invalid filter"), { code: 500 });
        httpDeleteMock.mockRejectedValueOnce(error).mockResolvedValueOnce({ data: { nbDeleted: '1' } });

        await watcher.delete({ scopes: 'Country', value: 'FR' });

        expect(httpDeleteMock).toHaveBeenCalledTimes(2);
        expect(httpDeleteMock.mock.calls[0][1].params).toMatchObject({ scope: 'Country', value: 'FR' });
        expect(httpDeleteMock.mock.calls[1][1].params).toMatchObject({ scopes: 'Country', value: 'FR' });
        expect(learn).toHaveBeenCalledWith('decisionScopesDelete', true);
    });

    it('should cache the learned scope parameter and avoid a second failed request', async () => {
        const capabilities = new CapabilityContext();
        // @ts-ignore
        watcher.capabilities = capabilities;
        const error = Object.assign(new Error("'scopes' doesn't exist: invalid filter"), { code: 500 });
        httpDeleteMock
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce({ data: { nbDeleted: '1' } })
            .mockResolvedValueOnce({ data: { nbDeleted: '0' } });

        await watcher.delete({ scopes: 'Country', value: 'FR' });
        expect(capabilities.supports('decisionScopesDelete')).toBe(false);

        await watcher.delete({ scopes: 'Country', value: 'ZZ' });

        expect(httpDeleteMock).toHaveBeenCalledTimes(3);
        expect(httpDeleteMock.mock.calls[2][1].params).toMatchObject({ scope: 'Country', value: 'ZZ' });
    });

    it('should retry on older unknown-filter wording', async () => {
        const supports = vi.fn().mockReturnValue(undefined);
        const learn = vi.fn();
        // @ts-ignore
        watcher.capabilities = { supports, learn };
        const error = Object.assign(new Error("unknown filter parameter 'scopes'"), { code: 500 });
        httpDeleteMock.mockRejectedValueOnce(error).mockResolvedValueOnce({ data: { nbDeleted: '1' } });

        await watcher.delete({ scopes: 'Country', value: 'FR' });

        expect(httpDeleteMock).toHaveBeenCalledTimes(2);
        expect(httpDeleteMock.mock.calls[1][1].params).toMatchObject({ scope: 'Country', value: 'FR' });
    });

    it('should not retry an unrelated 500', async () => {
        const supports = vi.fn().mockReturnValue(undefined);
        const learn = vi.fn();
        // @ts-ignore
        watcher.capabilities = { supports, learn };
        httpDeleteMock.mockRejectedValueOnce(Object.assign(new Error('database is down'), { code: 500 }));

        await expect(watcher.delete({ scopes: 'Country', value: 'FR' })).rejects.toThrow('database is down');
        expect(httpDeleteMock).toHaveBeenCalledTimes(1);
        expect(learn).not.toHaveBeenCalled();
    });
});
