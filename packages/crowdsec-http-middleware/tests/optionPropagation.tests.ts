import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrowdSecHTTPMiddleware } from '../src/CrowdSecHTTPMiddleware.js';
import { LiveCheckErrorBehavior, SubnetLevel } from '../src/ICrowdSecHTTPMiddlewareOptions.js';
import { IncomingMessage } from 'http';

const makeMiddleware = (bouncer?: Record<string, unknown>) =>
    new CrowdSecHTTPMiddleware({
        url: 'https://crowdsec.lan',
        getCurrentIp: (req: IncomingMessage) => req.socket.remoteAddress || '0.0.0.0',
        bouncer: {
            apiKey: 'test-apiKey',
            ...bouncer
        }
    });

describe('CrowdSecHTTPMiddleware option propagation', () => {
    it('should propagate bouncer options to the CrowdSecHTTPBouncerMiddleware instance', () => {
        const middleware = makeMiddleware({
            subnetLevel: SubnetLevel.resident,
            live: {
                enabled: true,
                cleanCacheTtl: 120,
                errorBehavior: LiveCheckErrorBehavior.failFast
            }
        });

        expect(middleware.bouncer).toBeDefined();
        // @ts-ignore private field, read only for the test
        expect(middleware.bouncer.minMask).toBe(SubnetLevel.resident);
        // @ts-ignore private field
        expect(middleware.bouncer.live.enabled).toBe(true);
        // @ts-ignore private field
        expect(middleware.bouncer.live.cleanCacheTtl).toBe(120);
        // @ts-ignore private field
        expect(middleware.bouncer.live.errorBehavior).toBe(LiveCheckErrorBehavior.failFast);
    });

    it('should apply default values when no bouncer options are provided', () => {
        const middleware = makeMiddleware();

        // @ts-ignore private field
        expect(middleware.bouncer.minMask).toBe(SubnetLevel.company);
        // @ts-ignore private field
        expect(middleware.bouncer.live.enabled).toBe(false);
        // @ts-ignore private field
        expect(middleware.bouncer.live.cleanCacheTtl).toBe(60);
    });
});
