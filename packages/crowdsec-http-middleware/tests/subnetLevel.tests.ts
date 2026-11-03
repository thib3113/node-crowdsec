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
    it('should ignore /0 decisions at every subnet level', () => {
        const levels = [undefined, SubnetLevel.resident, SubnetLevel.company, SubnetLevel.country];

        for (const level of levels) {
            const middleware = makeMiddleware(level);

            expect(addDecision(middleware, '0.0.0.0/0')).toBe(false);
            expect(addDecision(middleware, '::/0')).toBe(false);
            expect(middleware.decisionsCount).toBe(0);
            expect(checkIp(middleware, '203.0.113.7')).toBeUndefined();
            expect(checkIp(middleware, '2001:db8::1')).toBeUndefined();
        }
    });

    it('should not turn a short-prefix mapped dotted-quad into IPv4', () => {
        for (const level of [undefined, SubnetLevel.resident, SubnetLevel.company, SubnetLevel.country]) {
            const middleware = makeMiddleware(level);

            expect(addDecision(middleware, '::ffff:10.0.0.0/64')).toBe(false);
            expect(addDecision(middleware, '::ffff:0.0.0.0/0')).toBe(false);
        }
    });

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

        it('should apply the IPv4 policy to IPv6 (/120, not /119)', () => {
            expect(addDecision(middleware, '2001:db8::/120')).toBe(true);
            expect(checkIp(middleware, '2001:db8::1')?.value).toBe('2001:db8::/120');

            expect(addDecision(middleware, '2001:db8:1::/119')).toBe(false);
            expect(checkIp(middleware, '2001:db8:1::1')).toBeUndefined();
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

            // A real mapped address without a short prefix still becomes IPv4.
            expect(addDecision(middleware, '::ffff:10.0.0.6')).toBe(true);
            expect(checkIp(middleware, '10.0.0.6')?.value).toBe('::ffff:10.0.0.6');
        });

        it('should ignore /24 decisions', () => {
            addDecision(middleware, '10.0.0.0/24');
            expect(middleware.decisionsCount).toBe(0);
            expect(checkIp(middleware, '10.0.0.123')).toBeUndefined();
        });

        it('should apply the IPv4 policy to IPv6 (/128, not /64)', () => {
            expect(addDecision(middleware, '2001:db8::1/128')).toBe(true);
            expect(checkIp(middleware, '2001:db8::1')?.value).toBe('2001:db8::1/128');

            expect(addDecision(middleware, '2001:db8:2::/64')).toBe(false);
            expect(checkIp(middleware, '2001:db8:2::5')).toBeUndefined();
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

        it('should apply the IPv4 policy to IPv6 (/112, not /111)', () => {
            expect(addDecision(middleware, '2001:db8::/112')).toBe(true);
            expect(checkIp(middleware, '2001:db8::abcd')?.value).toBe('2001:db8::/112');

            expect(addDecision(middleware, '2001:db8:1::/111')).toBe(false);
            expect(checkIp(middleware, '2001:db8:1::1')).toBeUndefined();
        });
    });
});
