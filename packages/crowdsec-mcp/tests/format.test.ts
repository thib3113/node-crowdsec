import { describe, expect, it } from 'vitest';
import { escapeCell, expiry, formatDate, markdownTable, moreHint, plural, relativeTime, truncateRows } from '../src/format/common.js';

describe('format', () => {
    it('escapes markdown table cells', () => {
        expect(escapeCell('a|b\nc')).toBe('a\\|b c');
        expect(escapeCell(undefined)).toBe('—');
    });

    it('renders a markdown table', () => {
        const table = markdownTable(['Name', 'Count'], [['ban', '2']]);

        expect(table).toContain('| Name | Count |');
        expect(table).toContain('| ban  | 2     |');
    });

    it('renders an empty table', () => {
        expect(markdownTable(['Name'], [])).toBe('_No results._');
    });

    it('formats dates and relative times', () => {
        const now = Date.parse('2026-01-01T12:00:00Z');

        expect(formatDate('2026-01-01T12:00:00.000Z')).toBe('2026-01-01T12:00:00Z');
        expect(relativeTime('2026-01-01T13:30:00Z', now)).toBe('in 1h 30m');
        expect(relativeTime('2026-01-01T10:30:00Z', now)).toBe('1h 30m ago');
        expect(relativeTime(undefined)).toBe('—');
    });

    it('formats expirations', () => {
        const now = Date.parse('2026-01-01T12:00:00Z');

        expect(expiry(undefined)).toBe('never');
        expect(expiry('0001-01-01T00:00:00Z', now)).toBe('never');
        expect(expiry('2026-01-01T11:00:00Z', now)).toBe('expired');
        expect(expiry('2026-01-01T13:00:00Z', now)).toBe('in 1h');
    });

    it('truncates rows', () => {
        expect(truncateRows([1, 2, 3], 2)).toEqual({ rows: [1, 2], hidden: 1 });
        expect(truncateRows([1], 2)).toEqual({ rows: [1], hidden: 0 });
        expect(moreHint(3, 'list_alerts')).toContain('3 more');
        expect(moreHint(0, 'list_alerts')).toBe('');
    });

    it('pluralizes counts', () => {
        expect(plural(1, 'decision')).toBe('1 decision');
        expect(plural(2, 'decision')).toBe('2 decisions');
    });
});
