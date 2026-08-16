import { beforeEach, describe, expect, it } from 'vitest';
import { CrowdSecHTTPBouncerMiddleware } from '../src/CrowdSecHTTPBouncerMiddleware.js';
import { SubnetLevel } from '../src/ICrowdSecHTTPMiddlewareOptions.js';
import type { Decision } from 'crowdsec-client';
import { IncomingMessage } from 'http';

const makeMiddleware = (subnetLevel?: SubnetLevel) =>
    new CrowdSecHTTPBouncerMiddleware(
        {
            apiKey: 'test-apiKey',
            subnetLevel
        },
        { url: 'https://crowdsec.lan' }
    );

const addDecision = (middleware: CrowdSecHTTPBouncerMiddleware, value: string, type = 'ban') =>
    // @ts-ignore
    middleware.addDecision({ value, type } as unknown as Decision<'ip' | 'range'>);

const checkIp = (middleware: CrowdSecHTTPBouncerMiddleware, ip: string) => {
    const req = {} as IncomingMessage & { decision?: Decision };
    // @ts-ignore
    middleware.middleware(ip, req);
    return req.decision;
};

describe('CrowdSecHTTPBouncerMiddleware subnetLevel', () => {
    describe('default (company /24)', () => {
        let middleware: CrowdSecHTTPBouncerMiddleware;
        beforeEach(() => {
            middleware = makeMiddleware();
        });

        it('should match /32 decisions', () => {
            addDecision(middleware, '10.0.0.5');
            expect(checkIp(middleware, '10.0.0.5')?.value).toBe('10.0.0.5');
            expect(checkIp(middleware, '10.0.0.6')).toBeUndefined();
        });

        it('should match /24 decisions', () => {
            addDecision(middleware, '10.0.0.0/24');
            expect(checkIp(middleware, '10.0.0.123')?.value).toBe('10.0.0.0/24');
        });

        it('should ignore /8 decisions (bigger than company)', () => {
            addDecision(middleware, '10.0.0.0/8');
            expect(middleware.decisionsCount).toBe(0);
            expect(checkIp(middleware, '10.1.2.3')).toBeUndefined();
        });
    });

    describe('resident (/32 only)', () => {
        let middleware: CrowdSecHTTPBouncerMiddleware;
        beforeEach(() => {
            middleware = makeMiddleware(SubnetLevel.resident);
        });

        it('should match /32 decisions', () => {
            addDecision(middleware, '10.0.0.5');
            expect(checkIp(middleware, '10.0.0.5')?.value).toBe('10.0.0.5');
        });

        it('should ignore /24 decisions', () => {
            addDecision(middleware, '10.0.0.0/24');
            expect(middleware.decisionsCount).toBe(0);
            expect(checkIp(middleware, '10.0.0.123')).toBeUndefined();
        });
    });

    describe('country (/16)', () => {
        let middleware: CrowdSecHTTPBouncerMiddleware;
        beforeEach(() => {
            middleware = makeMiddleware(SubnetLevel.country);
        });

        it('should match /16 decisions', () => {
            addDecision(middleware, '10.0.0.0/16');
            expect(checkIp(middleware, '10.0.123.45')?.value).toBe('10.0.0.0/16');
        });

        it('should ignore /8 decisions', () => {
            addDecision(middleware, '10.0.0.0/8');
            expect(middleware.decisionsCount).toBe(0);
            expect(checkIp(middleware, '10.1.2.3')).toBeUndefined();
        });
    });
});
