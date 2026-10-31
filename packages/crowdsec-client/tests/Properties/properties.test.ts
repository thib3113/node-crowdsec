import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDuration, toGoDuration } from '../../src/duration.js';
import { getUrlRepresentation, parseExpiration } from '../../src/utils.js';

describe('property-based checks', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('round-trips any positive integer number of seconds through parseDuration/toGoDuration', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 1_000_000_000 }), (seconds) => {
                expect(parseDuration(toGoDuration(seconds))).toBe(seconds);
            })
        );
    });

    it('parses any generated cscli duration to the expected number of seconds', () => {
        const duration = fc.record({
            days: fc.integer({ min: 0, max: 999 }),
            hours: fc.integer({ min: 0, max: 23 }),
            minutes: fc.integer({ min: 0, max: 59 }),
            seconds: fc.integer({ min: 0, max: 59 })
        });

        fc.assert(
            fc.property(duration, ({ days, hours, minutes, seconds }) => {
                const expected = days * 86400 + hours * 3600 + minutes * 60 + seconds;
                if (expected === 0) {
                    expect(() => parseDuration('0s')).toThrow();
                    return;
                }

                const input = `${days}d${hours}h${minutes}m${seconds}s`;
                expect(parseDuration(input)).toBe(expected);
            })
        );
    });

    it('never leaks credentials in a rendered URL when passwords are hidden', () => {
        const credential = fc.stringMatching(/^[A-Za-z0-9]{4,24}$/);

        fc.assert(
            fc.property(credential, credential, (username, password) => {
                const request = {
                    baseURL: 'https://api-crowdsec.test.lan',
                    url: '/v1/decisions',
                    auth: { username, password }
                };

                const hidden = getUrlRepresentation(request, true);
                expect(hidden).toBe('https://api-crowdsec.test.lan/v1/decisions');

                const visible = getUrlRepresentation(request, false);
                expect(visible).toContain(password);
            })
        );
    });

    it('converts generated h/m/s durations to the matching expiration offset', () => {
        vi.spyOn(Date, 'now').mockReturnValue(0);
        const duration = fc.record({
            hours: fc.integer({ min: 0, max: 999 }),
            minutes: fc.integer({ min: 0, max: 59 }),
            seconds: fc.integer({ min: 0, max: 59 })
        });

        fc.assert(
            fc.property(duration, ({ hours, minutes, seconds }) => {
                const input = `${hours}h${minutes}m${seconds}s`;
                const offset = (hours * 3600 + minutes * 60 + seconds) * 1000;
                const negativeOffset = offset === 0 ? 0 : -offset;

                expect(parseExpiration(input).getTime()).toBe(offset);
                expect(parseExpiration(`-${input}`).getTime()).toBe(negativeOffset);
            })
        );
    });
});
