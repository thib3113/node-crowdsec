import { formatDuration } from '../utils.js';

const BACKSLASH = String.fromCodePoint(92);

function stringifyCell(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (typeof value === 'object') {
        return JSON.stringify(value) ?? '';
    }
    if (typeof value === 'symbol') {
        return value.toString();
    }
    if (typeof value === 'function') {
        return value.name || 'function';
    }
    return '';
}

const ORIGIN_CASING: Record<string, string> = {
    capi: 'CAPI',
    console: 'console',
    crowdsec: 'crowdsec',
    cscli: 'cscli',
    'cscli-import': 'cscli-import',
    lists: 'lists'
};

/**
 * Restore the canonical CrowdSec casing for an origin. The bouncer `Decision`
 * class lowercases origins, while the watcher API keeps `CAPI` as-is.
 */
export function formatOrigin(value?: string): string | undefined {
    if (!value) {
        return value;
    }
    return ORIGIN_CASING[value.toLowerCase()] ?? value;
}

export function escapeCell(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return '—';
    }

    return stringifyCell(value)
        .replaceAll(BACKSLASH, BACKSLASH + BACKSLASH)
        .replaceAll('|', BACKSLASH + '|')
        .replace(/[\r\n]+/g, ' ');
}

export function markdownTable(headers: string[], rows: string[][]): string {
    if (rows.length === 0) {
        return '_No results._';
    }

    const widths = headers.map((header, index) => {
        const cells = rows.map((row) => (row[index] ?? '').length);
        return Math.max(header.length, ...cells);
    });

    const renderRow = (cells: string[]) => `| ${cells.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join(' | ')} |`;

    const separator = `| ${widths.map((width) => '-'.repeat(Math.max(3, width))).join(' | ')} |`;

    return [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');
}

export function formatDate(value?: string | Date): string {
    if (!value) {
        return '—';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toISOString().replace('.000Z', 'Z');
}

export function relativeTime(value?: string | Date, now = Date.now()): string {
    if (!value) {
        return '—';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const deltaSeconds = Math.round((date.getTime() - now) / 1000);
    const absolute = formatDuration(Math.abs(deltaSeconds));

    if (deltaSeconds === 0) {
        return 'now';
    }

    return deltaSeconds > 0 ? `in ${absolute}` : `${absolute} ago`;
}

export function expiry(value?: string | Date, now = Date.now()): string {
    if (!value) {
        return 'never';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    // Go's zero time serializes as 0001-01-01T00:00:00Z (notably for allowlist
    // items with no expiration); treat it as "never".
    if (date.getUTCFullYear() <= 1) {
        return 'never';
    }

    return date.getTime() <= now ? 'expired' : relativeTime(date, now);
}

export function formatDecisionExpiry(expiryInfo: { expires?: string; active: boolean }): string {
    if (expiryInfo.expires) {
        return `${formatDate(expiryInfo.expires)} (${expiry(expiryInfo.expires)})`;
    }

    return expiryInfo.active ? '—' : 'expired';
}

export function truncateRows<T>(rows: T[], maxResults: number): { rows: T[]; hidden: number } {
    if (rows.length <= maxResults) {
        return { rows, hidden: 0 };
    }

    return { rows: rows.slice(0, maxResults), hidden: rows.length - maxResults };
}

export function moreHint(hidden: number, toolName: string): string {
    if (hidden <= 0) {
        return '';
    }

    return `\n_${hidden} more result(s) hidden. Increase \`limit\` or narrow the filters._`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function bullets(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
}
