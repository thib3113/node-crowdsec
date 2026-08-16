import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrowdSecHTTPBouncerMiddleware } from '../src/CrowdSecHTTPBouncerMiddleware.js';
import { LiveCheckErrorBehavior } from '../src/ICrowdSecHTTPMiddlewareOptions.js';
import type { Decision } from 'crowdsec-client';
import { IncomingMessage } from 'http';

const makeMiddleware = (live?: Record<string, unknown>) =>
    new CrowdSecHTTPBouncerMiddleware(
        {
            apiKey: 'test-apiKey',
            live: {
                enabled: true,
                ...live
            }
        },
        { url: 'https://crowdsec.lan' }
    );

const waitForLiveEvent = (middleware: CrowdSecHTTPBouncerMiddleware, event: 'liveClean' | 'liveDecisionAdded' | 'liveCheckError') =>
    new Promise<void>((resolve) => {
        middleware.liveEvents.once(event, () => resolve());
    }).then(() => {
        // let the spawnLiveCheck `finally` ( pendingChecks cleanup ) run
        return new Promise<void>((resolve) => setImmediate(resolve));
    });

const checkIp = async (middleware: CrowdSecHTTPBouncerMiddleware, ip: string) => {
    const req = {} as IncomingMessage & { decision?: Decision };
    // @ts-ignore
    middleware.middleware(ip, req);
    // let the fire-and-forget live check complete
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    return req.decision;
};

describe('CrowdSecHTTPBouncerMiddleware live mode', () => {
    let middleware: CrowdSecHTTPBouncerMiddleware;
    let mockSearch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        middleware = makeMiddleware();
        mockSearch = vi.fn();
        // @ts-ignore
        middleware.client.Decisions.search = mockSearch;
    });

    it('should let an unknown ip pass on the first request, then block it on the second', async () => {
        mockSearch.mockResolvedValueOnce([{ type: 'ban', value: '10.0.0.5', duration: '1h' }]);

        // first request : passes ( live check running in background )
        const firstReq = {} as IncomingMessage & { decision?: Decision };
        // @ts-ignore
        middleware.middleware('10.0.0.5', firstReq);
        expect(firstReq.decision).toBeUndefined();
        expect(mockSearch).toHaveBeenCalledWith({ ip: '10.0.0.5' });

        // wait for the live check to complete and inject the decision
        await waitForLiveEvent(middleware, 'liveDecisionAdded');
        expect(middleware.decisionsCount).toBe(1);

        // second request : banned
        expect((await checkIp(middleware, '10.0.0.5'))?.value).toBe('10.0.0.5');
    });

    it('should cache a clean verdict and not re-check', async () => {
        mockSearch.mockResolvedValueOnce([]);

        await checkIp(middleware, '10.0.0.5');
        expect(mockSearch).toHaveBeenCalledTimes(1);

        // second request : served from the clean cache, no new live check
        await checkIp(middleware, '10.0.0.5');
        expect(mockSearch).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent live checks for the same ip (thundering herd)', async () => {
        let resolveSearch!: (v: unknown) => void;
        mockSearch.mockImplementationOnce(() => new Promise((resolve) => (resolveSearch = resolve)));

        const req1 = {} as IncomingMessage & { decision?: Decision };
        const req2 = {} as IncomingMessage & { decision?: Decision };
        // @ts-ignore
        middleware.middleware('10.0.0.5', req1);
        // @ts-ignore
        middleware.middleware('10.0.0.5', req2);

        expect(mockSearch).toHaveBeenCalledTimes(1);

        resolveSearch([{ type: 'ban', value: '10.0.0.5', duration: '1h' }]);
        await waitForLiveEvent(middleware, 'liveDecisionAdded');
        expect(middleware.decisionsCount).toBe(1);
    });

    it('should fail open and backoff when the live check errors', async () => {
        mockSearch.mockRejectedValueOnce(new Error('LAPI down'));

        // first request : passes, error cached
        const req = {} as IncomingMessage & { decision?: Decision };
        // @ts-ignore
        middleware.middleware('10.0.0.5', req);
        await waitForLiveEvent(middleware, 'liveCheckError');

        expect(mockSearch).toHaveBeenCalledTimes(1);
        expect(req.decision).toBeUndefined();

        // second request during backoff : passes, no re-check
        const req2 = {} as IncomingMessage & { decision?: Decision };
        // @ts-ignore
        middleware.middleware('10.0.0.5', req2);
        expect(mockSearch).toHaveBeenCalledTimes(1);
    });

    it('should not cache errors in failFast mode (re-check on every request)', async () => {
        const middlewareFailFast = makeMiddleware({ errorBehavior: LiveCheckErrorBehavior.failFast });
        const mockSearch2 = vi.fn().mockRejectedValue(new Error('LAPI down'));
        // @ts-ignore
        middlewareFailFast.client.Decisions.search = mockSearch2;

        const req1 = {} as IncomingMessage & { decision?: Decision };
        // @ts-ignore
        middlewareFailFast.middleware('10.0.0.5', req1);
        await waitForLiveEvent(middlewareFailFast, 'liveCheckError');

        const req2 = {} as IncomingMessage & { decision?: Decision };
        // @ts-ignore
        middlewareFailFast.middleware('10.0.0.5', req2);
        await waitForLiveEvent(middlewareFailFast, 'liveCheckError');

        expect(mockSearch2).toHaveBeenCalledTimes(2);
    });

    it('should emit live events', async () => {
        const onClean = vi.fn();
        middleware.liveEvents.on('liveClean', onClean);
        mockSearch.mockResolvedValueOnce([]);

        await checkIp(middleware, '10.0.0.5');
        expect(onClean).toHaveBeenCalledWith('10.0.0.5');
    });

    it('should remove expired decisions on the expiration scan', async () => {
        mockSearch.mockResolvedValueOnce([{ type: 'ban', value: '10.0.0.5', duration: '0s' }]);

        const firstReq = {} as IncomingMessage & { decision?: Decision };
        // @ts-ignore
        middleware.middleware('10.0.0.5', firstReq);
        await waitForLiveEvent(middleware, 'liveDecisionAdded');
        expect(middleware.decisionsCount).toBe(1);

        // the decision is already expired (duration 0) : the scan must remove it
        // @ts-ignore
        middleware.removeExpiredDecisions();
        expect(middleware.decisionsCount).toBe(0);

        // a subsequent request is no longer banned
        expect((await checkIp(middleware, '10.0.0.5'))?.value).toBeUndefined();
    });
});
