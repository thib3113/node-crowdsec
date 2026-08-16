import { describe, expect, it } from 'vitest';
import { IpDecisionDB } from '../src/IpDecisionDB.js';
import { getIpObject } from '../src/utils.js';
import { Address4, Address6 } from 'ip-address';

const ipv4 = (ip: string) => getIpObject(ip);
const ipv6 = (ip: string) => new Address6(ip);

describe('IpDecisionDB', () => {
    describe('ipv4', () => {
        it('should match an exact ip', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv4('1.2.3.4'), 'exact');

            expect(db.lookup(ipv4('1.2.3.4'))).toBe('exact');
            expect(db.lookup(ipv4('1.2.3.5'))).toBeUndefined();
        });

        it('should match a /24 range', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv4('1.2.3.0/24'), 'range');

            expect(db.lookup(ipv4('1.2.3.0'))).toBe('range');
            expect(db.lookup(ipv4('1.2.3.255'))).toBe('range');
            expect(db.lookup(ipv4('1.2.4.0'))).toBeUndefined();
            expect(db.lookup(ipv4('1.2.2.255'))).toBeUndefined();
        });

        it('should match a /8 range', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv4('10.0.0.0/8'), 'range');

            expect(db.lookup(ipv4('10.255.255.255'))).toBe('range');
            expect(db.lookup(ipv4('11.0.0.0'))).toBeUndefined();
        });

        it('should return the most specific match', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv4('1.2.0.0/16'), 'wide');
            db.insert(ipv4('1.2.3.0/24'), 'narrow');

            expect(db.lookup(ipv4('1.2.3.4'))).toBe('narrow');
            expect(db.lookup(ipv4('1.2.99.4'))).toBe('wide');
        });

        it('should support deletion', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv4('1.2.3.4'), 'a');
            db.insert(ipv4('1.2.3.4'), 'b');

            expect(db.lookup(ipv4('1.2.3.4'))).toBe('a');

            db.delete(ipv4('1.2.3.4'), (d) => d === 'a');
            expect(db.lookup(ipv4('1.2.3.4'))).toBe('b');

            db.delete(ipv4('1.2.3.4'), (d) => d === 'b');
            expect(db.lookup(ipv4('1.2.3.4'))).toBeUndefined();
        });

        it('should match an ipv4-mapped ipv6 as ipv4', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv4('10.0.0.0/8'), 'range');

            // ::ffff:10.0.0.5 is unwrapped to Address4 by getIpObject
            expect(db.lookup(ipv4('::ffff:10.0.0.5'))).toBe('range');
        });

        it('should match ip on a high first octet (>= 128)', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv4('200.5.2.0/24'), 'high');

            expect(db.lookup(ipv4('200.5.2.128'))).toBe('high');
            expect(db.lookup(ipv4('200.5.3.1'))).toBeUndefined();
        });
    });

    describe('ipv6', () => {
        it('should match an exact ip', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv6('2001:db8::1'), 'exact');

            expect(db.lookup(ipv6('2001:db8::1'))).toBe('exact');
            expect(db.lookup(ipv6('2001:db8::2'))).toBeUndefined();
        });

        it('should match a /32 range', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv6('2001:db8::/32'), 'range');

            expect(db.lookup(ipv6('2001:db8::1'))).toBe('range');
            expect(db.lookup(ipv6('2001:db8:ffff::1'))).toBe('range');
            expect(db.lookup(ipv6('2001:db9::1'))).toBeUndefined();
        });

        it('should not confuse a low-value ipv6 with an ipv4', () => {
            const db = new IpDecisionDB<string>();
            db.insert(ipv6('::1'), 'loopback');

            expect(db.lookup(ipv6('::1'))).toBe('loopback');
            // 0.0.0.1 must NOT be matched by the `::1` decision
            expect(db.lookup(ipv4('0.0.0.1'))).toBeUndefined();
        });
    });
});
