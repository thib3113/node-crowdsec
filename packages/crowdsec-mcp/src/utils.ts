import { isIP } from 'node:net';

const DURATION_PART = /(\d+(?:\.\d+)?)(d|h|m|s)/g;

/**
 * Parse a cscli-like duration (4h, 30m, 7d, 1h30m) into seconds.
 */
export function parseDuration(input: string): number {
    const value = input.trim();
    if (value === '') {
        throw new Error('duration must not be empty');
    }

    if (/^\d+$/.test(value)) {
        return Number(value);
    }

    let total = 0;
    let consumed = 0;
    for (const match of value.matchAll(DURATION_PART)) {
        const amount = Number(match[1]);
        const unit = match[2];
        consumed += match[0].length;
        switch (unit) {
            case 'd':
                total += amount * 86400;
                break;
            case 'h':
                total += amount * 3600;
                break;
            case 'm':
                total += amount * 60;
                break;
            case 's':
                total += amount;
                break;
        }
    }

    if (consumed !== value.length || total <= 0) {
        throw new Error(`invalid duration '${input}' (use for example 30m, 4h or 7d)`);
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
