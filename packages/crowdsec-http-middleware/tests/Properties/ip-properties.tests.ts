import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Address4, Address6 } from 'ip-address';
import { IpDecisionDB } from '../../src/IpDecisionDB.js';
import { MAX_IP_LENGTH, getIpObject } from '../../src/utils.js';

const UINT32 = (1n << 32n) - 1n;

const toIpv4 = (value: bigint): string => [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 0xffn)).join('.');

const maskFor = (prefix: number): bigint => (prefix === 0 ? 0n : UINT32 ^ ((1n << BigInt(32 - prefix)) - 1n));

const arbitraryIpv4 = fc.integer({ min: 0, max: 0xffffffff }).map(BigInt);

const ipv6Parts = fc
    .tuple(fc.integer({ min: 1, max: 0xffff }), fc.array(fc.integer({ min: 0, max: 0xffff }), { minLength: 7, maxLength: 7 }))
    .map(([head, rest]) => [head, ...rest]);

const toIpv6 = (parts: Array<number>): string => parts.map((part) => part.toString(16)).join(':');

describe('IP handling properties', () => {
    it('parses and normalizes every IPv4 address', () => {
        fc.assert(
            fc.property(arbitraryIpv4, (value) => {
                const ip = toIpv4(value);
                const parsed = getIpObject(ip);

                expect(parsed).toBeInstanceOf(Address4);
                expect(parsed.bigInt()).toBe(value);
                expect(parsed.subnetMask).toBe(32);
                expect(getIpObject(parsed.correctForm()).bigInt()).toBe(value);
            })
        );
    });

    it('unwraps IPv4-mapped IPv6 addresses to IPv4', () => {
        fc.assert(
            fc.property(arbitraryIpv4, (value) => {
                const parsed = getIpObject(`::ffff:${toIpv4(value)}`);

                expect(parsed).toBeInstanceOf(Address4);
                expect(parsed.bigInt()).toBe(value);
            })
        );
    });

    it('matches every address inside a generated IPv4 CIDR and nothing outside', () => {
        fc.assert(
            fc.property(arbitraryIpv4, fc.integer({ min: 1, max: 32 }), arbitraryIpv4, (address, prefix, hostBits) => {
                const mask = maskFor(prefix);
                const network = address & mask;
                const inside = network | (hostBits & (UINT32 ^ mask));

                const db = new IpDecisionDB<string>();
                db.insert(getIpObject(`${toIpv4(network)}/${prefix}`), 'network');

                expect(db.lookup(getIpObject(toIpv4(inside)))).toBe('network');

                const outside = (network ^ (1n << BigInt(32 - prefix))) & UINT32;
                expect(db.lookup(getIpObject(toIpv4(outside)))).toBeUndefined();
            })
        );
    });

    it('prefers the most specific range', () => {
        fc.assert(
            fc.property(arbitraryIpv4, fc.integer({ min: 2, max: 32 }), arbitraryIpv4, (address, narrowPrefix, hostBits) => {
                const widePrefix = narrowPrefix - 1;
                const narrowMask = maskFor(narrowPrefix);
                const wideMask = maskFor(widePrefix);
                const narrowNetwork = address & narrowMask;
                const wideNetwork = address & wideMask;
                const inside = narrowNetwork | (hostBits & (UINT32 ^ narrowMask));

                const db = new IpDecisionDB<string>();
                db.insert(getIpObject(`${toIpv4(wideNetwork)}/${widePrefix}`), 'wide');
                db.insert(getIpObject(`${toIpv4(narrowNetwork)}/${narrowPrefix}`), 'narrow');

                expect(db.lookup(getIpObject(toIpv4(inside)))).toBe('narrow');

                const outsideNarrow = (narrowNetwork ^ (1n << BigInt(32 - narrowPrefix))) & UINT32;
                expect(db.lookup(getIpObject(toIpv4(outsideNarrow)))).toBe('wide');
            })
        );
    });

    it('keeps the remaining decisions when one is deleted', () => {
        fc.assert(
            fc.property(arbitraryIpv4, fc.integer({ min: 1, max: 32 }), (address, prefix) => {
                const network = address & maskFor(prefix);
                const ip = getIpObject(`${toIpv4(network)}/${prefix}`);

                const db = new IpDecisionDB<string>();
                db.insert(ip, 'first');
                db.insert(ip, 'second');

                expect(db.lookup(ip)).toBe('first');
                expect(db.delete(ip, (decision) => decision === 'first')).toBe(true);
                expect(db.lookup(ip)).toBe('second');
                expect(db.delete(ip, (decision) => decision === 'second')).toBe(true);
                expect(db.lookup(ip)).toBeUndefined();
            })
        );
    });

    it('parses IPv6 addresses and matches a generated /64', () => {
        fc.assert(
            fc.property(ipv6Parts, (parts) => {
                const parsed = getIpObject(toIpv6(parts));

                expect(parsed).toBeInstanceOf(Address6);
                expect(parsed.subnetMask).toBe(128);
                expect(getIpObject(parsed.correctForm()).bigInt()).toBe(parsed.bigInt());

                const db = new IpDecisionDB<string>();
                db.insert(getIpObject(`${toIpv6(parts.slice(0, 4))}::/64`), 'v6');

                expect(db.lookup(parsed)).toBe('v6');

                const outside = [parts[0] ^ 1, ...parts.slice(1)].map((part) => part & 0xffff);
                expect(db.lookup(getIpObject(toIpv6(outside)))).toBeUndefined();
            })
        );
    });

    it('rejects oversized inputs before parsing', () => {
        fc.assert(
            fc.property(fc.string({ minLength: MAX_IP_LENGTH + 1, maxLength: MAX_IP_LENGTH + 64 }), (payload) => {
                expect(() => getIpObject(payload)).toThrowError(expect.objectContaining({ name: 'AddressError' }));
            })
        );
    });

    it('either parses an arbitrary string or raises an AddressError', () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 64 }), (payload) => {
                try {
                    const parsed = getIpObject(payload);
                    expect(parsed instanceof Address4 || parsed instanceof Address6).toBe(true);
                } catch (error) {
                    expect((error as { name?: string }).name).toBe('AddressError');
                }
            })
        );
    });
});
