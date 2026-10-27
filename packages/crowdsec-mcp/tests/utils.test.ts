import { describe, expect, it } from 'vitest';
import {
    assertValidScopeValue,
    formatDuration,
    isValidCidr,
    isValidIp,
    isValidTimeFilter,
    normalizeScope,
    parseDuration,
    splitList
} from '../src/utils.js';

describe('utils', () => {
    it('parses cscli durations', () => {
        expect(parseDuration('30m')).toBe(1800);
        expect(parseDuration('4h')).toBe(14400);
        expect(parseDuration('7d')).toBe(604800);
        expect(parseDuration('1h30m')).toBe(5400);
    });

    it('rejects invalid durations', () => {
        expect(() => parseDuration('')).toThrow();
        expect(() => parseDuration('abc')).toThrow();
        expect(() => parseDuration('4 hours')).toThrow();
        expect(() => parseDuration('0h')).toThrow();
        expect(() => parseDuration('90')).toThrow("invalid duration '90': use 30m, 4h or 7d");
        expect(() => parseDuration('300')).toThrow("invalid duration '300': use 30m, 4h or 7d");
    });

    it('validates and normalizes scope values', () => {
        expect(assertValidScopeValue('Country', 'de')).toBe('DE');
        expect(assertValidScopeValue('AS', 'AS64512')).toBe('64512');
        expect(assertValidScopeValue('AS', '64512')).toBe('64512');
        expect(assertValidScopeValue('Username', ' admin ')).toBe('admin');
        expect(() => assertValidScopeValue('Country', 'ZZ')).toThrow(/invalid country code/);
        expect(() => assertValidScopeValue('Country', 'FRA')).toThrow(/invalid country code/);
        expect(() => assertValidScopeValue('AS', 'not-a-number')).toThrow(/invalid AS number/);
        expect(() => assertValidScopeValue('AS', 'AS0')).toThrow(/positive numeric ASN/);
        expect(() => assertValidScopeValue('Ip', 'nope')).toThrow(/valid ip/);
        expect(() => assertValidScopeValue('Range', '10.0.0.0')).toThrow(/valid range/);
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

    it('validates time filters', () => {
        expect(isValidTimeFilter('4h')).toBe(true);
        expect(isValidTimeFilter('3650d')).toBe(true);
        expect(isValidTimeFilter('87600h')).toBe(true);
        expect(isValidTimeFilter('10y')).toBe(false);
        expect(isValidTimeFilter('90')).toBe(false);
        expect(isValidTimeFilter('2026-01-01T00:00:00Z')).toBe(false);
        expect(isValidTimeFilter('banana')).toBe(false);
    });

    it('splits comma-separated lists', () => {
        expect(splitList('a, b ,c')).toEqual(['a', 'b', 'c']);
        expect(splitList('')).toBeUndefined();
        expect(splitList(undefined)).toBeUndefined();
    });
});
