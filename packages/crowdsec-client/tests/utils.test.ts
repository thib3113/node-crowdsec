import { parseExpiration } from '../src/utils.js';
import { jest, describe, it, afterEach, beforeEach, expect } from '@jest/globals';

describe('utils', () => {
    describe('parseExpiration', () => {
        const RealDate = Date.now;

        beforeEach(() => {
            global.Date.now = jest.fn(() => new Date('2019-04-07T10:20:30Z').getTime());
        });

        afterEach(() => {
            global.Date.now = RealDate;
        });
        const testDatas: Array<[string, number]> = [
            ['48.11435635s', 48114],
            ['-11h29m39.698479471s', -41379699],
            ['59m49.264032632s', 3589264],
            ['2h59m', 10740000],
            ['-4h29m', -16140000]
        ];

        it.each(testDatas)('should parse "%s" to %dms', async (duration, ms) => {
            const parsedExpiration = parseExpiration(duration);
            expect(parsedExpiration).toBeInstanceOf(Date);
            expect(parsedExpiration.getTime() - Date.now()).toBe(ms);
        });
        it('should fail to parse', async () => {
            expect(() => {
                parseExpiration('fake');
            }).toThrow(`fail to parse duration "fake"`);
        });
    });
});
