import { afterEach, beforeEach, describe, expect, jest } from '@jest/globals';
import type { CrowdSecClient as TypeCrowdSecClient } from '../../src/Clients/CrowdSecClient.js';
import type { ICrowdSecClientOptions } from '../../src/index.js';
import Mock = jest.Mock;
import Validate from '../../src/Validate.js';
import * as https from 'https';
import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';
import { EErrorsCodes } from '../../src/Errors/EErrorsCodes.js';

const mockAxios: {
    defaults: { headers: {} };
    create: Mock;
    isAxiosError: Mock;
    head: Mock;
    interceptors: { request: { use: Mock }; response: { use: Mock } };
} = {
    defaults: {
        headers: {}
    },
    interceptors: {
        request: {
            use: jest.fn()
        },
        response: {
            use: jest.fn()
        }
    },
    create: jest.fn().mockImplementation(() => mockAxios),
    isAxiosError: jest.fn(),
    head: jest.fn()
};
jest.unstable_mockModule('axios', () => ({
    default: mockAxios
}));
jest.unstable_mockModule('../../src/pkg.js', () => ({
    pkg: {
        name: 'test-crowdsec',
        version: '1.0.0'
    }
}));

const clearAllMocks = (mocks: Record<string, unknown>) => {
    Object.entries(mocks).forEach(([name, mock]) => {
        if (Validate.implementsTKeys<Mock>(mock, ['_isMockFunction']) && mock._isMockFunction) {
            mock.mockClear();
        } else if (Validate.isObject(mock)) {
            clearAllMocks(mock as Record<string, unknown>);
        }
    });
};

// @ts-ignore
const { CrowdSecClient } = (await import('../../src/Clients/CrowdSecClient.js')) as {
    CrowdSecClient: typeof TypeCrowdSecClient;
};

afterEach(() => {
    clearAllMocks(mockAxios);
    mockAxios.defaults = {
        headers: {}
    };
});

describe('CrowdSecClient.ts', () => {
    class FakeClient extends CrowdSecClient {
        public constructor(options: ICrowdSecClientOptions) {
            super(options);
        }

        login(): Promise<void> {
            return Promise.resolve(undefined);
        }

        stop(): Promise<void> {
            return Promise.resolve(undefined);
        }

        testConnection(): Promise<void> {
            return Promise.resolve(undefined);
        }
    }

    describe('constructor', () => {
        it('should construct the client', async () => {
            new FakeClient({
                url: 'https://crowdsec.lan',
                timeout: 4000,
                userAgent: `test/v1.0.0`,
                strictSSL: true
            });

            expect(mockAxios.create).toHaveBeenCalledWith({
                baseURL: 'https://crowdsec.lan',
                headers: { 'User-Agent': 'test/v1.0.0' },
                httpsAgent: undefined,
                timeout: 4000
            });
        });

        it('should construct the client with default options', async () => {
            new FakeClient({
                url: 'https://crowdsec.lan'
            });

            expect(mockAxios.create).toHaveBeenCalledWith({
                baseURL: 'https://crowdsec.lan',
                headers: { 'User-Agent': 'node-test-crowdsec/v1.0.0' },
                httpsAgent: undefined,
                timeout: 2000
            });
        });

        it('should remove trailing slash on url', async () => {
            new FakeClient({
                url: 'https://crowdsec.lan/'
            });

            expect(mockAxios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    baseURL: 'https://crowdsec.lan'
                })
            );
        });

        it('should pass custom https agent if strictSSL is disabled', async () => {
            new FakeClient({
                url: 'https://crowdsec.lan/',
                strictSSL: false
            });

            expect(mockAxios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    httpsAgent: expect.any(https.Agent)
                })
            );
        });

        it('should allow to get http agent with http value', async () => {
            const client = new FakeClient({
                url: 'https://crowdsec.lan/',
                strictSSL: false
            });

            expect(mockAxios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    httpsAgent: expect.any(https.Agent)
                })
            );

            expect(client.http).toBe(mockAxios);
        });
    });

    describe('functions', () => {
        let client: FakeClient;
        beforeEach(() => {
            client = new FakeClient({
                url: 'https://crowdsec.lan',
                timeout: 4000,
                userAgent: `test/v1.0.0`,
                strictSSL: true
            });
        });

        describe('setAuthenticationHeaders', () => {
            it('should allow to set authentication headers', async () => {
                expect(client.http.defaults.headers).toStrictEqual({});
                // @ts-ignore
                client.setAuthenticationHeaders({ Authorization: 'test' });
                expect(client.http.defaults.headers).toStrictEqual({ Authorization: 'test' });
            });
        });

        describe('setAuthenticationByTLS', () => {
            it('should allow to set authentication by TLS certificate', async () => {
                expect(client.http.defaults.httpsAgent).not.toBeDefined();
                // @ts-ignore
                client.options.strictSSL = null;
                // @ts-ignore
                client.setAuthenticationByTLS({
                    key: 'key',
                    cert: 'cert',
                    ca: 'ca'
                });
                expect((client.http.defaults.httpsAgent as https.Agent).options).toStrictEqual(
                    expect.objectContaining({
                        key: 'key',
                        cert: 'cert',
                        ca: 'ca',
                        rejectUnauthorized: true
                    })
                );
            });

            it('should allow to set authentication by TLS certificate without strict certificate check', async () => {
                expect(client.http.defaults.httpsAgent).not.toBeDefined();

                // @ts-ignore
                client.options.strictSSL = false;
                // @ts-ignore
                client.setAuthenticationByTLS({
                    key: 'key',
                    cert: 'cert',
                    ca: 'ca'
                });
                expect((client.http.defaults.httpsAgent as https.Agent).options).toStrictEqual(
                    expect.objectContaining({
                        key: 'key',
                        cert: 'cert',
                        ca: 'ca',
                        rejectUnauthorized: false
                    })
                );
            });
        });

        describe('_testConnection', () => {
            let testConnection: FakeClient['_testConnection'];
            beforeEach(() => {
                // @ts-ignore
                testConnection = client._testConnection.bind(client);
            });
            it('should handle valid connection', async () => {
                mockAxios.head.mockImplementationOnce(() => ({ status: 200 }));
                await testConnection('tutu');
                expect(mockAxios.head).toHaveBeenCalledWith('tutu', { validateStatus: expect.any(Function) });
            });
            it('should handle invalid key', async () => {
                mockAxios.head.mockImplementationOnce(() => ({ status: 403 }));
                expect.assertions(4);
                try {
                    await testConnection('tutu');
                } catch (e) {
                    expect(e).toBeInstanceOf(CrowdsecClientError);
                    const err = e as CrowdsecClientError;
                    expect(err.code).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
                    expect(err.message).toBe('UNEXPECTED_KEY');
                }
                expect(mockAxios.head).toHaveBeenCalledWith('tutu', { validateStatus: expect.any(Function) });
            });
            it('should handle unknown status', async () => {
                mockAxios.head.mockImplementationOnce(() => ({ status: 500 }));
                expect.assertions(4);
                try {
                    await testConnection('tutu');
                } catch (e) {
                    expect(e).toBeInstanceOf(CrowdsecClientError);
                    const err = e as CrowdsecClientError;
                    expect(err.code).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
                    expect(err.message).toBe('UNEXPECTED_STATUS_CODE');
                }
                expect(mockAxios.head).toHaveBeenCalledWith('tutu', { validateStatus: expect.any(Function) });
            });
            it('should handle unknown axios error', async () => {
                const fakeError = new Error('fake');
                mockAxios.head.mockImplementationOnce(() => {
                    throw fakeError;
                });
                mockAxios.isAxiosError.mockReturnValue(true);

                expect.assertions(5);
                try {
                    await testConnection('tutu');
                } catch (e) {
                    expect(e).toBeInstanceOf(CrowdsecClientError);
                    const err = e as CrowdsecClientError;
                    expect(err.code).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
                    expect(err.message).toBe('HOST_NOT_REACHABLE');
                    expect(err.exception).toBe(fakeError);
                }
                expect(mockAxios.head).toHaveBeenCalledWith('tutu', { validateStatus: expect.any(Function) });
            });
            it('should handle unknown error', async () => {
                const fakeError = new Error('fake');
                mockAxios.head.mockImplementationOnce(() => {
                    throw fakeError;
                });
                mockAxios.isAxiosError.mockReturnValue(false);

                expect.assertions(5);
                try {
                    await testConnection('tutu');
                } catch (e) {
                    expect(e).toBeInstanceOf(CrowdsecClientError);
                    const err = e as CrowdsecClientError;
                    expect(err.code).toBe(EErrorsCodes.UNKNOWN_ERROR);
                    expect(err.message).toBe('UNKNOWN_ERROR');
                    expect(err.exception).toBe(fakeError);
                }
                expect(mockAxios.head).toHaveBeenCalledWith('tutu', { validateStatus: expect.any(Function) });
            });
            it('should handle unknown throw', async () => {
                mockAxios.head.mockImplementationOnce(() => {
                    throw {};
                });
                mockAxios.isAxiosError.mockReturnValue(false);

                expect.assertions(5);
                try {
                    await testConnection('tutu');
                } catch (e) {
                    expect(e).toBeInstanceOf(CrowdsecClientError);
                    const err = e as CrowdsecClientError;
                    expect(err.code).toBe(EErrorsCodes.UNKNOWN_ERROR);
                    expect(err.message).toBe('UNKNOWN_ERROR');
                    expect(err.exception).toBe(undefined);
                }
                expect(mockAxios.head).toHaveBeenCalledWith('tutu', { validateStatus: expect.any(Function) });
            });
            it('should pass function that will allow all statuses', async () => {
                mockAxios.head.mockImplementationOnce(() => ({ status: 200 }));
                await testConnection('tutu');

                // @ts-ignore
                expect(mockAxios.head.mock.calls?.[0]?.[1]?.validateStatus).toBeDefined();
                // @ts-ignore
                const validateStatus: (status?: number) => boolean = mockAxios.head.mock.calls?.[0]?.[1]?.validateStatus;

                [undefined, 100, 200, 300, 301, 400, 401, 403, 500].forEach((code) => {
                    expect(validateStatus(code)).toBeTruthy();
                });
            });
        });
    });
});
