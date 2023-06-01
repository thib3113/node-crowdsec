import { forceArray, getUrlRepresentation, parseExpiration } from '../src/utils.js';
import { jest, describe, it, afterEach, beforeEach, expect } from '@jest/globals';
import { RawAxiosRequestConfig } from 'axios';

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

    describe('getUrlRepresentation', () => {
        const baseConfiguration: RawAxiosRequestConfig = {
            baseURL: 'https://api-crowdsec.test.lan',
            url: '/v1/heartbeat',
            params: {
                a: 'b',
                b: 2,
                c: '',
                d: undefined,
                e: null,
                f: true,
                g: false
            },
            auth: {
                password: 'password',
                username: 'username'
            }
        };
        const testsDatas: Array<[string, boolean, RawAxiosRequestConfig]> = [
            ['https://api-crowdsec.test.lan/v1/heartbeat?a=b&b=2&c=&f=true&g=false', true, baseConfiguration],
            ['https://username:password@api-crowdsec.test.lan/v1/heartbeat?a=b&b=2&c=&f=true&g=false', false, baseConfiguration]
        ];

        it.each(testsDatas)('should render the url : %s', async (result, hidePassword, configuration) => {
            expect(getUrlRepresentation(configuration, hidePassword)).toBe(result);
        });
    });

    describe('forceArray', () => {
        it('should convert string to array of strings', async () => {
            expect(forceArray('test')).toStrictEqual(['test']);
        });
        it('should return array of strings without modifications', async () => {
            const arr = ['test'];
            expect(forceArray(arr)).toBe(arr);
        });
    });
});