const UNIT_SECONDS: Record<string, number> = {
    h: 3600,
    m: 60,
    s: 1
};

/**
 * A duration string accepted by CrowdSec (`30m`, `4h`, `7d`, `1h30m`).
 * `d` is a CrowdSec extension to Go's `time.ParseDuration`.
 */
export type GoDuration = string;

const DAY_SECONDS = 86400;

function invalidDuration(input: string): Error {
    return new Error(`invalid duration '${input}': use 30m, 4h or 7d`);
}

interface ParsedNumber {
    amount: number;
    next: number;
}

function readNumber(value: string, start: number): ParsedNumber | undefined {
    let index = start;
    while (value[index] !== undefined && value[index] >= '0' && value[index] <= '9') {
        index++;
    }
    if (index === start) {
        return undefined;
    }

    if (value[index] === '.') {
        index++;
        const fractionStart = index;
        while (value[index] !== undefined && value[index] >= '0' && value[index] <= '9') {
            index++;
        }
        if (index === fractionStart) {
            return undefined;
        }
    }

    return { amount: Number(value.slice(start, index)), next: index };
}

/**
 * Parse the Go-style part of a duration (h/m/s, fractions allowed).
 * Days are handled by the caller because CrowdSec only accepts `d` as the first unit.
 */
function parseGoDuration(value: string, input: string): number {
    let total = 0;
    let index = 0;
    let matched = false;

    while (index < value.length) {
        const parsed = readNumber(value, index);
        if (!parsed) {
            throw invalidDuration(input);
        }

        const unit = value[parsed.next];
        const multiplier = unit === undefined ? undefined : UNIT_SECONDS[unit];
        if (multiplier === undefined) {
            throw invalidDuration(input);
        }

        total += parsed.amount * multiplier;
        index = parsed.next + 1;
        matched = true;
    }

    if (!matched) {
        throw invalidDuration(input);
    }

    return total;
}

/**
 * Parse a CrowdSec/cscli duration into seconds.
 *
 * Mirrors `github.com/crowdsecurity/go-cs-lib/cstime`: `d` (24h) is supported
 * only as the first unit, must be an integer, and `w` is not supported.
 */
export function parseDuration(input: string): number {
    const value = input.trim();
    if (value === '') {
        throw new Error('duration must not be empty');
    }

    let total = 0;
    let rest = value;
    const days = /^(\d+)d(.*)$/.exec(rest);

    if (days) {
        total += Number(days[1]) * DAY_SECONDS;
        rest = days[2];
        if (rest.includes('d')) {
            throw invalidDuration(input);
        }
        if (rest !== '') {
            total += parseGoDuration(rest, input);
        }
    } else {
        if (value.includes('d')) {
            throw invalidDuration(input);
        }
        total += parseGoDuration(value, input);
    }

    if (!Number.isFinite(total) || total <= 0) {
        throw invalidDuration(input);
    }

    return total;
}

/**
 * Human-readable duration, used in tool output (e.g. `1d 1h`).
 */
export function formatDuration(seconds: number): string {
    if (seconds <= 0) {
        return '0s';
    }

    const days = Math.floor(seconds / DAY_SECONDS);
    const hours = Math.floor((seconds % DAY_SECONDS) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && days === 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
}

function formatSeconds(seconds: number): string {
    return String(Number(seconds.toFixed(6)));
}

/**
 * Normalize a duration to the Go `time.ParseDuration` format used on the LAPI
 * wire. Days are converted to hours because Go does not understand `d`.
 *
 * Numbers are interpreted as seconds.
 */
export function toGoDuration(input: string | number): GoDuration {
    const total = typeof input === 'number' ? input : parseDuration(input);
    if (!Number.isFinite(total) || total <= 0) {
        throw invalidDuration(String(input));
    }

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total - hours * 3600 - minutes * 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${formatSeconds(seconds)}s`);

    return parts.join('');
}
