import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration, toGoDuration } from '../../src/duration.js';

describe('duration', () => {
    describe('parseDuration', () => {
        it('parses cscli durations', () => {
            expect(parseDuration('30m')).toBe(1800);
            expect(parseDuration('4h')).toBe(14400);
            expect(parseDuration('7d')).toBe(604800);
            expect(parseDuration('1h30m')).toBe(5400);
            expect(parseDuration('2d3h4m5s')).toBe(2 * 86400 + 3 * 3600 + 4 * 60 + 5);
        });

        it('rejects invalid durations', () => {
            expect(() => parseDuration('')).toThrow();
            expect(() => parseDuration('abc')).toThrow();
            expect(() => parseDuration('4 hours')).toThrow();
            expect(() => parseDuration('0h')).toThrow();
            expect(() => parseDuration('90')).toThrow("invalid duration '90': use 30m, 4h or 7d");
            expect(() => parseDuration('1.5d')).toThrow();
            expect(() => parseDuration('2d4d')).toThrow();
            expect(() => parseDuration('1h30m2d')).toThrow();
            expect(() => parseDuration('1w')).toThrow();
        });
    });

    describe('formatDuration', () => {
        it('formats durations for humans', () => {
            expect(formatDuration(0)).toBe('0s');
            expect(formatDuration(5400)).toBe('1h 30m');
            expect(formatDuration(90000)).toBe('1d 1h');
        });
    });

    describe('toGoDuration', () => {
        it('normalizes days to hours for the LAPI wire format', () => {
            expect(toGoDuration('7d')).toBe('168h');
            expect(toGoDuration('2d3h')).toBe('51h');
            expect(toGoDuration('1h30m')).toBe('1h30m');
            expect(toGoDuration('90s')).toBe('1m30s');
            expect(toGoDuration(300)).toBe('5m');
        });

        it('rejects invalid input', () => {
            expect(() => toGoDuration('nope')).toThrow();
            expect(() => toGoDuration(0)).toThrow();
            expect(() => toGoDuration(-1)).toThrow();
        });
    });
});
