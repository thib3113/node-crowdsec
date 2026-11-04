import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrowdSecHTTPMiddleware } from '../src/CrowdSecHTTPMiddleware.js';
import { CrowdSecHTTPBouncerMiddleware } from '../src/CrowdSecHTTPBouncerMiddleware.js';
import { LiveCheckErrorBehavior, SubnetLevel } from '../src/ICrowdSecHTTPMiddlewareOptions.js';
import { LapiCapability } from 'crowdsec-client';
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

    it('should propagate client options to the clients', () => {
        const middleware = new CrowdSecHTTPMiddleware({
            url: 'https://crowdsec.lan',
            clientOptions: {
                lapiVersion: '1.8.2',
                detectCapabilities: true,
                strictCapabilities: true
            },
            bouncer: { apiKey: 'test-apiKey' }
        });

        // @ts-ignore private field
        expect(middleware.bouncer.client.options.lapiVersion).toBe('1.8.2');
        // @ts-ignore private field
        expect(middleware.bouncer.client.options.detectCapabilities).toBe(true);
        // @ts-ignore private field
        expect(middleware.bouncer.client.options.strictCapabilities).toBe(true);
    });

    it('should use the socket address when getCurrentIp is not configured', () => {
        const middleware = new CrowdSecHTTPMiddleware({
            url: 'https://crowdsec.lan',
            bouncer: { apiKey: 'test-apiKey' }
        });
        const req = { socket: { remoteAddress: '203.0.113.9' }, headers: {} } as unknown as IncomingMessage;
        // @ts-ignore private field
        const spy = vi.spyOn(middleware.bouncer, 'middleware').mockImplementation(() => {});

        middleware.getMiddleware()(req);

        expect(spy).toHaveBeenCalledWith('203.0.113.9', req);
    });

    it('should propagate client options to the watcher client', () => {
        const middleware = new CrowdSecHTTPMiddleware({
            url: 'https://crowdsec.lan',
            clientOptions: {
                lapiVersion: '1.8.2',
                detectCapabilities: true,
                strictCapabilities: true
            },
            watcher: { machineID: 'machine', password: 'password' }
        });

        // @ts-ignore private field
        expect(middleware.watcher.client.options.lapiVersion).toBe('1.8.2');
        // @ts-ignore private field
        expect(middleware.watcher.client.options.detectCapabilities).toBe(true);
        // @ts-ignore private field
        expect(middleware.watcher.client.options.strictCapabilities).toBe(true);
    });

    it.each([false, undefined])('should omit stream scopes when streamScopes is %s', async (value) => {
        const middleware = new CrowdSecHTTPBouncerMiddleware(
            { apiKey: 'test-apiKey', live: { enabled: false, watchdog: false } },
            { url: 'https://crowdsec.lan' }
        );
        // @ts-ignore private field
        middleware.client.login = vi.fn().mockResolvedValue(undefined);
        const supports = vi.fn().mockReturnValue(value);
        // @ts-ignore private field
        middleware.client.supports = supports;
        const stream = { on: vi.fn(), resume: vi.fn(), close: vi.fn() };
        const getStream = vi.fn().mockReturnValue(stream);
        // @ts-ignore private field
        middleware.client.Decisions.getStream = getStream;

        await middleware.start();

        expect(supports).toHaveBeenCalledWith(LapiCapability.streamScopes);
        expect(getStream).toHaveBeenCalledWith(expect.not.objectContaining({ scopes: expect.anything() }));
    });

    it('should send stream scopes when streamScopes is confirmed', async () => {
        const middleware = new CrowdSecHTTPBouncerMiddleware(
            { apiKey: 'test-apiKey', live: { enabled: false, watchdog: false } },
            { url: 'https://crowdsec.lan' }
        );
        // @ts-ignore private field
        middleware.client.login = vi.fn().mockResolvedValue(undefined);
        const supports = vi.fn().mockReturnValue(true);
        // @ts-ignore private field
        middleware.client.supports = supports;
        const stream = { on: vi.fn(), resume: vi.fn(), close: vi.fn() };
        const getStream = vi.fn().mockReturnValue(stream);
        // @ts-ignore private field
        middleware.client.Decisions.getStream = getStream;

        await middleware.start();

        expect(supports).toHaveBeenCalledWith(LapiCapability.streamScopes);
        expect(getStream).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['ip', 'range'] }));
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
