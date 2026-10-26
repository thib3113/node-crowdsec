import { describe, expect, it } from 'vitest';
import { formatDuration, isValidCidr, isValidIp, normalizeScope, parseDuration, splitList } from '../src/utils.js';

describe('utils', () => {
    it('parses cscli durations', () => {
        expect(parseDuration('30m')).toBe(1800);
        expect(parseDuration('4h')).toBe(14400);
        expect(parseDuration('7d')).toBe(604800);
        expect(parseDuration('1h30m')).toBe(5400);
        expect(parseDuration('90')).toBe(90);
    });

    it('rejects invalid durations', () => {
        expect(() => parseDuration('')).toThrow();
        expect(() => parseDuration('abc')).toThrow();
        expect(() => parseDuration('4 hours')).toThrow();
        expect(() => parseDuration('0h')).toThrow();
    });

    it('formats durations', () => {
        expect(formatDuration(0)).toBe('0s');
        expect(formatDuration(5400)).toBe('1h 30m');
        expect(formatDuration(90000)).toBe('1d 1h');
    });

    it('validates IPs and CIDRs', () => {
        expect(isValidIp('1.2.3.4')).toBe(true);
        expect(isValidIp('2001:db8::1')).toBe(true);
        expect(isValidIp('not-an-ip')).toBe(false);
        expect(isValidCidr('10.0.0.0/8')).toBe(true);
        expect(isValidCidr('2001:db8::/32')).toBe(true);
        expect(isValidCidr('10.0.0.0/33')).toBe(false);
        expect(isValidCidr('10.0.0.0')).toBe(false);
    });

    it('normalizes scopes like cscli', () => {
        expect(normalizeScope('ip')).toBe('Ip');
        expect(normalizeScope('RANGE')).toBe('Range');
        expect(normalizeScope('username')).toBe('Username');
        expect(normalizeScope('custom')).toBe('Custom');
        expect(normalizeScope(undefined, '1.2.3.4')).toBe('Ip');
        expect(normalizeScope(undefined, undefined, '10.0.0.0/8')).toBe('Range');
    });

    it('rejects invalid IPs and CIDRs in normalizeScope', () => {
        expect(() => normalizeScope(undefined, 'nope')).toThrow(/valid ip/);
        expect(() => normalizeScope(undefined, undefined, 'nope')).toThrow(/valid range/);
    });

    it('splits comma-separated lists', () => {
        expect(splitList('a, b ,c')).toEqual(['a', 'b', 'c']);
        expect(splitList('')).toBeUndefined();
        expect(splitList(undefined)).toBeUndefined();
    });
});
