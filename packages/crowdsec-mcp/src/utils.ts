import { isIP } from 'node:net';

const DURATION_UNITS: Record<string, number> = {
    d: 86400,
    h: 3600,
    m: 60,
    s: 1
};

function isDigit(char: string | undefined): boolean {
    return char !== undefined && char >= '0' && char <= '9';
}

/**
 * Parse a cscli-like duration (4h, 30m, 7d, 1h30m) into seconds.
 */
export function parseDuration(input: string): number {
    const value = input.trim();
    if (value === '') {
        throw new Error('duration must not be empty');
    }

    let total = 0;
    let index = 0;

    while (index < value.length) {
        const start = index;
        while (isDigit(value[index])) {
            index++;
        }

        if (index === start) {
            throw new Error(`invalid duration '${input}': use 30m, 4h or 7d`);
        }

        if (value[index] === '.') {
            index++;
            const fractionStart = index;
            while (isDigit(value[index])) {
                index++;
            }
            if (index === fractionStart) {
                throw new Error(`invalid duration '${input}': use 30m, 4h or 7d`);
            }
        }

        const amount = Number(value.slice(start, index));
        const unit = value[index];
        const multiplier = unit === undefined ? undefined : DURATION_UNITS[unit];

        if (multiplier === undefined) {
            throw new Error(`invalid duration '${input}': use 30m, 4h or 7d`);
        }

        total += amount * multiplier;
        index++;
    }

    if (total <= 0) {
        throw new Error(`invalid duration '${input}': use 30m, 4h or 7d`);
    }

    return total;
}

export function formatDuration(seconds: number): string {
    if (seconds <= 0) {
        return '0s';
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && days === 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
}

export function isValidIp(value: string): boolean {
    return isIP(value) !== 0;
}

export function isValidCidr(value: string): boolean {
    const [address, prefix, ...rest] = value.split('/');
    if (rest.length > 0 || prefix === undefined) {
        return false;
    }

    const family = isIP(address);
    if (family === 0) {
        return false;
    }

    if (!/^\d+$/.test(prefix)) {
        return false;
    }

    const prefixNumber = Number(prefix);
    return family === 4 ? prefixNumber >= 0 && prefixNumber <= 32 : prefixNumber >= 0 && prefixNumber <= 128;
}

/**
 * Mirror cscli's scope normalization and IP/range validation.
 */
export function normalizeScope(scope?: string, ip?: string, range?: string): string {
    if (range) {
        if (!isValidCidr(range)) {
            throw new Error(`${range} is not a valid range`);
        }
        return 'Range';
    }

    if (ip) {
        if (!isValidIp(ip)) {
            throw new Error(`${ip} is not a valid ip`);
        }
        return 'Ip';
    }

    if (!scope) {
        return 'Ip';
    }

    const known: Record<string, string> = {
        ip: 'Ip',
        range: 'Range',
        username: 'Username',
        session: 'Session',
        country: 'Country',
        as: 'AS'
    };

    const normalized = known[scope.toLowerCase()];
    if (normalized) {
        return normalized;
    }

    return scope.charAt(0).toUpperCase() + scope.slice(1);
}

const DECISION_SCOPES = new Set(['Ip', 'Range', 'Username', 'Session', 'Country', 'AS']);
const DECISION_TYPES = new Set(['ban', 'captcha', 'throttle']);

export function assertValidDecisionScope(scope: string): string {
    const normalized = normalizeScope(scope);
    if (!DECISION_SCOPES.has(normalized)) {
        throw new Error(`invalid scope '${scope}' (expected Ip, Range, Username, Session, Country or AS)`);
    }
    return normalized;
}

export function assertValidDecisionType(type: string): string {
    const normalized = type.toLowerCase();
    if (!DECISION_TYPES.has(normalized)) {
        throw new Error(`invalid decision type '${type}' (expected ban, captcha or throttle)`);
    }
    return normalized;
}

const COUNTRY_CODE = /^[A-Z]{2}$/;
const AS_NUMBER = /^(?:AS)?\d+$/i;

/**
 * Validate and normalize the value for a non-IP decision scope.
 * Ip/Range values are validated as IP/CIDR; Country values must be ISO-like
 * two-letter codes; AS values must be numeric ASNs.
 */
export function assertValidScopeValue(scope: string, value: string): string {
    const normalizedScope = assertValidDecisionScope(scope);
    const trimmed = value.trim();

    if (!trimmed) {
        throw new Error('value must not be empty');
    }

    switch (normalizedScope) {
        case 'Country': {
            const code = trimmed.toUpperCase();
            if (!COUNTRY_CODE.test(code) || code === 'ZZ') {
                throw new Error(`invalid country code '${value}': use a two-letter ISO 3166 code (e.g. FR, US)`);
            }
            return code;
        }
        case 'AS': {
            if (!AS_NUMBER.test(trimmed)) {
                throw new Error(`invalid AS number '${value}': use a numeric ASN (e.g. 64512)`);
            }
            const asn = trimmed.replace(/^AS/i, '');
            if (Number(asn) <= 0) {
                throw new Error(`invalid AS number '${value}': use a positive numeric ASN (e.g. 64512)`);
            }
            return asn;
        }
        case 'Ip':
            assertValidIp(trimmed);
            return trimmed;
        case 'Range':
            assertValidCidr(trimmed);
            return trimmed;
        default:
            return trimmed;
    }
}

export function parsePositiveId(value: string | number, name = 'id'): string {
    const raw = String(value).trim();
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    return raw;
}

export interface ListWindow {
    /** Number of rows to render. */
    displayLimit: number;
    /** Limit to send to the LAPI. 0 means "no limit". */
    fetchLimit: number;
    /** True when the LAPI response may contain more rows than it returned. */
    maybeMore: boolean;
}

/**
 * Resolve pagination for list tools.
 *
 * An explicit `limit` fetches all matching rows so the hidden count can be
 * exact. Without an explicit limit we keep the request small and only hint
 * that more rows may exist.
 */
export function resolveListWindow(limit: number | undefined, all: boolean, defaultLimit: number): ListWindow {
    if (all) {
        return { displayLimit: Number.MAX_SAFE_INTEGER, fetchLimit: 0, maybeMore: false };
    }

    const displayLimit = limit ?? defaultLimit;
    return {
        displayLimit,
        fetchLimit: limit === undefined ? displayLimit : 0,
        maybeMore: limit === undefined
    };
}

export function assertValidIp(value: string, name = 'ip'): void {
    if (!isValidIp(value)) {
        throw new Error(`${value} is not a valid ${name}`);
    }
}

export function assertValidCidr(value: string, name = 'range'): void {
    if (!isValidCidr(value)) {
        throw new Error(`${value} is not a valid ${name}`);
    }
}

export function isValidTimeFilter(value: string): boolean {
    try {
        parseDuration(value);
        return true;
    } catch {
        return false;
    }
}

export interface DecisionExpiry {
    expires?: string;
    active: boolean;
}

export function resolveDecisionExpiry(
    decision: { until?: string; duration?: string },
    base?: string | Date,
    now = Date.now()
): DecisionExpiry {
    if (decision.until) {
        const time = Date.parse(decision.until);
        if (Number.isNaN(time)) {
            return { active: false };
        }
        return { expires: new Date(time).toISOString(), active: time > now };
    }

    const duration = decision.duration?.trim();
    if (!duration) {
        return { active: true };
    }

    if (duration.startsWith('-')) {
        return { active: false };
    }

    let seconds: number;
    try {
        seconds = parseDuration(duration);
    } catch {
        return { active: false };
    }

    let baseDate: Date;
    if (base instanceof Date) {
        baseDate = base;
    } else if (base === undefined) {
        baseDate = new Date(now);
    } else {
        baseDate = new Date(base);
    }

    if (Number.isNaN(baseDate.getTime())) {
        return { active: true };
    }

    const expires = new Date(baseDate.getTime() + seconds * 1000);
    return { expires: expires.toISOString(), active: expires.getTime() > now };
}

export function splitList(value?: string): string[] | undefined {
    if (!value) {
        return undefined;
    }

    const items = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return items.length > 0 ? items : undefined;
}
