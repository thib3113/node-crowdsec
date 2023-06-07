import { createDebugger, forceArray, getUrlRepresentation, parseExpiration, setImmediatePromise } from '../src/utils.js';
import { jest, describe, it, afterEach, beforeEach, expect } from '@jest/globals';
import { RawAxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';

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
            ['-4h29m', -16140000],
            ['99999999h59m59.264032632s', 359999999999264]
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
        it('should fail to parse too big numbers', async () => {
            const duration = "'999999999h59m59.264032632s'";
            expect(() => {
                parseExpiration(duration);
            }).toThrow(`fail to parse duration "${duration}"`);
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
            ['https://username:password@api-crowdsec.test.lan/v1/heartbeat?a=b&b=2&c=&f=true&g=false', false, baseConfiguration],
            ['http://localhost/v1/heartbeat?a=b&b=2&c=&f=true&g=false', true, { ...baseConfiguration, baseURL: '' }],
            ['https://api-crowdsec.test.lan/?a=b&b=2&c=&f=true&g=false', true, { ...baseConfiguration, url: '' }],
            ['https://api-crowdsec.test.lan/?a=b&b=2&c=&f=true&g=false', true, { ...baseConfiguration, url: undefined }]
        ];

        it.each(testsDatas)('should render the url : %s', async (result, hidePassword, configuration) => {
            expect(getUrlRepresentation(configuration, hidePassword)).toBe(result);
        });

        it('should hidePassword by default', async () => {
            expect(
                getUrlRepresentation({
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
                })
            ).toBe('https://api-crowdsec.test.lan/v1/heartbeat?a=b&b=2&c=&f=true&g=false');
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

    describe('createDebugger', () => {
        it('should create a debugger', () => {
            const d = createDebugger('test');
            expect(d.namespace).toBe('crowdsec-client:test');
        });
        it('should force to set a name', () => {
            expect.assertions(2);
            try {
                createDebugger('');
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
                expect((e as Error).message).toBe('name is mandatory');
            }
        });
    });

    describe('setImmediatePromise', () => {
        it('should not block the event loop', async () => {
            let i = 0;
            const maxI = 1e4;
            const res = (async () => {
                while (++i < maxI) {
                    //do something
                    crypto.randomUUID();

                    await setImmediatePromise();
                }
            })();

            //this part will be run only if not blocked
            expect(i).toBeGreaterThan(0);
            expect(i).toBeLessThan(maxI);

            await res;

            expect(i).toBe(maxI);
        });
    });
});
