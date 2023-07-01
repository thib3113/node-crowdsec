import { afterEach, beforeEach, describe, expect, jest, it } from '@jest/globals';
import type { CrowdSecClient as TypeCrowdSecClient } from '../../src/Clients/CrowdSecClient.js';
import type { ICrowdSecClientOptions } from '../../src/index.js';
import Validate from '../../src/Validate.js';
import * as https from 'https';
import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';
import { EErrorsCodes } from '../../src/Errors/EErrorsCodes.js';
import Mock = jest.Mock;
import { AxiosError } from '../../src/Errors/AxiosError.js';
import { CrowdSecServerError } from '../../src/Errors/CrowdSecServerError.js';

const mockDebug = jest.fn();
const mockDebugExtend = jest.fn().mockImplementation(() => mockDebug);
const createDebuggerMock = jest.fn().mockImplementation(() => mockDebug);
// @ts-ignore
mockDebug.extend = mockDebugExtend;

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

const mockGetUrlRepresentation = jest.fn();
jest.unstable_mockModule('../../src/utils.js', () => ({
    createDebugger: createDebuggerMock,
    getUrlRepresentation: mockGetUrlRepresentation
}));
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
    Object.entries(mocks).forEach(([, mock]) => {
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

//TODO unit test getHTTPClient

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
        let mockGetHTTPClient: jest.Spied<any>;
        beforeEach(() => {
            // @ts-ignore
            mockGetHTTPClient = jest.spyOn(CrowdSecClient, 'getHTTPClient').mockImplementation(() => {});
        });
        afterEach(() => {
            mockGetHTTPClient.mockRestore();
        });
        it('should construct the client', async () => {
            new FakeClient({
                url: 'https://crowdsec.lan',
                timeout: 4000,
                userAgent: `test/v1.0.0`,
                strictSSL: true
            });

            expect(mockGetHTTPClient).toHaveBeenCalledWith({
                url: 'https://crowdsec.lan',
                userAgent: 'test/v1.0.0',
                strictSSL: true,
                timeout: 4000
            });
        });

        it('should construct the client with default options', async () => {
            new FakeClient({
                url: 'https://crowdsec.lan'
            });

            expect(mockGetHTTPClient).toHaveBeenCalledWith({
                url: 'https://crowdsec.lan'
            });
        });
    });

    //TODO
    // describe('getHTTP', () => {
    //     it('should remove trailing slash on url', async () => {
    //         new FakeClient({
    //             url: 'https://crowdsec.lan/'
    //         });
    //
    //         expect(mockGetHTTPClient).toHaveBeenCalledWith(
    //             expect.objectContaining({
    //                 url: 'https://crowdsec.lan'
    //             })
    //         );
    //     });
    //     it('should pass custom https agent if strictSSL is disabled', async () => {
    //         new FakeClient({
    //             url: 'https://crowdsec.lan/',
    //             strictSSL: false
    //         });
    //
    //         expect(mockGetHTTPClient).toHaveBeenCalledWith(
    //             expect.objectContaining({
    //                 httpsAgent: expect.any(https.Agent)
    //             })
    //         );
    //     });
    //

    // });

    describe('addAxiosDebugInterceptors', () => {
        describe('function', () => {});
        describe('interceptors', () => {
            describe('logger', () => {
                it('should log the request', async () => {
                    new FakeClient({
                        url: 'https://crowdsec.lan',
                        timeout: 4000,
                        userAgent: `test/v1.0.0`,
                        strictSSL: true
                    });

                    mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                    const verboseRequestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0] as (config: any) => unknown;
                    expect(verboseRequestInterceptor).toBeDefined();

                    const config = {
                        method: 'GET',
                        headers: {},
                        data: {}
                    };
                    const newConfig = verboseRequestInterceptor(config);

                    expect(newConfig).toStrictEqual({ ...config });
                    // @ts-ignore
                    expect(newConfig.metadata.startTime).toStrictEqual(expect.any(Date));

                    expect(mockDebug).toHaveBeenCalledWith(`Starting Request on url GET <urlRepresentation>`);
                    expect(mockDebug).toHaveBeenCalledWith('headers : %O', config.headers);
                    expect(mockDebug).toHaveBeenCalledWith('payload : %O', config.data);

                    expect(mockGetUrlRepresentation).toHaveBeenCalledWith(config);
                });
                it('should log the success response with duration', async () => {
                    new FakeClient({
                        url: 'https://crowdsec.lan',
                        timeout: 4000,
                        userAgent: `test/v1.0.0`,
                        strictSSL: true
                    });

                    mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                    const verboseResponseSuccessInterceptor = mockAxios.interceptors.response.use.mock.calls[0][0] as (
                        config: any
                    ) => unknown;
                    expect(verboseResponseSuccessInterceptor).toBeDefined();

                    const response = {
                        config: {
                            method: 'GET',
                            metadata: {
                                startTime: Date.now() - 10
                            }
                        },
                        headers: {},
                        data: {},
                        status: 200,
                        statusText: 'ok'
                    };
                    verboseResponseSuccessInterceptor(response);

                    expect(mockDebug).toHaveBeenNthCalledWith(
                        1,
                        expect.stringMatching(/Response from GET <urlRepresentation> with code 200 ok in [0-9.]+ seconds/)
                    );
                    expect(mockDebug).toHaveBeenNthCalledWith(2, 'headers : %O', response.headers);
                    expect(mockDebug).toHaveBeenNthCalledWith(3, 'payload : %O', response.data);

                    expect(mockGetUrlRepresentation).toHaveBeenCalledWith(response.config);
                });
                it('should log the success response without duration', async () => {
                    new FakeClient({
                        url: 'https://crowdsec.lan',
                        timeout: 4000,
                        userAgent: `test/v1.0.0`,
                        strictSSL: true
                    });

                    mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                    const verboseResponseSuccessInterceptor = mockAxios.interceptors.response.use.mock.calls[0][0] as (
                        config: any
                    ) => unknown;
                    expect(verboseResponseSuccessInterceptor).toBeDefined();

                    const response = {
                        config: {
                            method: 'GET'
                        },
                        headers: {},
                        data: {},
                        status: 200,
                        statusText: 'ok'
                    };
                    verboseResponseSuccessInterceptor(response);

                    expect(mockDebug).toHaveBeenNthCalledWith(
                        1,
                        expect.stringMatching(/Response from GET <urlRepresentation> with code 200 ok/)
                    );
                    expect(mockDebug).toHaveBeenNthCalledWith(2, 'headers : %O', response.headers);
                    expect(mockDebug).toHaveBeenNthCalledWith(3, 'payload : %O', response.data);

                    expect(mockGetUrlRepresentation).toHaveBeenCalledWith(response.config);
                });
                it('should log the error with response', async () => {
                    new FakeClient({
                        url: 'https://crowdsec.lan',
                        timeout: 4000,
                        userAgent: `test/v1.0.0`,
                        strictSSL: true
                    });

                    mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                    const verboseResponseSuccessInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1] as (
                        config: any
                    ) => unknown;
                    expect(verboseResponseSuccessInterceptor).toBeDefined();

                    const error = {
                        response: {
                            config: {
                                method: 'GET'
                            },
                            headers: {},
                            data: {},
                            status: 200,
                            statusText: 'ok'
                        }
                    };
                    expect.assertions(6);
                    try {
                        verboseResponseSuccessInterceptor(error);
                    } catch (e) {
                        expect(e).toBe(error);
                        expect(mockDebug).toHaveBeenNthCalledWith(
                            1,
                            expect.stringMatching(/Response from GET <urlRepresentation> with code 200 ok/)
                        );
                        expect(mockDebug).toHaveBeenNthCalledWith(2, 'headers : %O', error.response.headers);
                        expect(mockDebug).toHaveBeenNthCalledWith(3, 'payload : %O', error.response.data);

                        expect(mockGetUrlRepresentation).toHaveBeenCalledWith(error.response.config);
                    }
                });
                it('should log unknown axios error with response', async () => {
                    new FakeClient({
                        url: 'https://crowdsec.lan',
                        timeout: 4000,
                        userAgent: `test/v1.0.0`,
                        strictSSL: true
                    });

                    mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                    const verboseResponseSuccessInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1] as (
                        config: any
                    ) => unknown;
                    expect(verboseResponseSuccessInterceptor).toBeDefined();

                    const error = {
                        isAxiosError: true,
                        config: {
                            method: 'get'
                        },
                        code: 500,
                        message: 'fail'
                    };
                    expect.assertions(3);
                    try {
                        verboseResponseSuccessInterceptor(error);
                    } catch (e) {
                        expect(e).toBe(error);
                        expect(mockDebug).toHaveBeenNthCalledWith(1, 'Response from get <urlRepresentation> with code 500 fail');
                    }
                });
            });
            describe('error handler', () => {
                it('should skip on success', async () => {
                    new FakeClient({
                        url: 'https://crowdsec.lan',
                        timeout: 4000,
                        userAgent: `test/v1.0.0`,
                        strictSSL: true
                    });

                    const errorHandler = mockAxios.interceptors.response.use.mock.calls[1][0] as (config: any) => unknown;
                    expect(errorHandler).toBeDefined();

                    const response = {};

                    expect(errorHandler(response)).toBe(response);
                });
                describe('errors', () => {
                    it('should throw error with response message', async () => {
                        new FakeClient({
                            url: 'https://crowdsec.lan',
                            timeout: 4000,
                            userAgent: `test/v1.0.0`,
                            strictSSL: true
                        });

                        mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                        const errorHandler = mockAxios.interceptors.response.use.mock.calls[1][1] as (config: any) => unknown;
                        expect(errorHandler).toBeDefined();

                        const error = {
                            response: {
                                data: {
                                    message: 'response error'
                                },
                                status: 401
                            }
                        };
                        expect.assertions(5);
                        try {
                            errorHandler(error);
                        } catch (e) {
                            expect(e).toBeInstanceOf(CrowdSecServerError);
                            const error = e as CrowdSecServerError;
                            expect(error.message).toBe('response error');
                            expect(error.code).toBe(401);
                            expect(error.exception).toBeInstanceOf(AxiosError);
                        }
                    });
                    it('should throw error with response errors', async () => {
                        new FakeClient({
                            url: 'https://crowdsec.lan',
                            timeout: 4000,
                            userAgent: `test/v1.0.0`,
                            strictSSL: true
                        });

                        mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                        const errorHandler = mockAxios.interceptors.response.use.mock.calls[1][1] as (config: any) => unknown;
                        expect(errorHandler).toBeDefined();

                        const error = {
                            response: {
                                data: {
                                    errors: 'response errors'
                                },
                                status: 401
                            }
                        };
                        expect.assertions(5);
                        try {
                            errorHandler(error);
                        } catch (e) {
                            expect(e).toBeInstanceOf(CrowdSecServerError);
                            const error = e as CrowdSecServerError;
                            expect(error.message).toBe('response errors (response errors)');
                            expect(error.code).toBe(401);
                            expect(error.exception).toBeInstanceOf(AxiosError);
                        }
                    });
                    it('should throw error without response with statusText', async () => {
                        new FakeClient({
                            url: 'https://crowdsec.lan',
                            timeout: 4000,
                            userAgent: `test/v1.0.0`,
                            strictSSL: true
                        });

                        mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                        const errorHandler = mockAxios.interceptors.response.use.mock.calls[1][1] as (config: any) => unknown;
                        expect(errorHandler).toBeDefined();

                        const error = {
                            response: {
                                status: 401,
                                statusText: 'fail'
                            }
                        };
                        expect.assertions(5);
                        try {
                            errorHandler(error);
                        } catch (e) {
                            expect(e).toBeInstanceOf(CrowdSecServerError);
                            const error = e as CrowdSecServerError;
                            expect(error.message).toBe('fail');
                            expect(error.code).toBe(401);
                            expect(error.exception).toBeInstanceOf(AxiosError);
                        }
                    });
                    it('should throw error without response without statusText', async () => {
                        new FakeClient({
                            url: 'https://crowdsec.lan',
                            timeout: 4000,
                            userAgent: `test/v1.0.0`,
                            strictSSL: true
                        });

                        mockGetUrlRepresentation.mockReturnValueOnce('<urlRepresentation>');

                        const errorHandler = mockAxios.interceptors.response.use.mock.calls[1][1] as (config: any) => unknown;
                        expect(errorHandler).toBeDefined();

                        const error = {
                            response: {
                                status: 401
                            }
                        };
                        expect.assertions(5);
                        try {
                            errorHandler(error);
                        } catch (e) {
                            expect(e).toBeInstanceOf(CrowdSecServerError);
                            const error = e as CrowdSecServerError;
                            expect(error.message).toBe('Unknown HTTP Error');
                            expect(error.code).toBe(401);
                            expect(error.exception).toBeInstanceOf(AxiosError);
                        }
                    });
                });
            });
        });
    });

    describe('getHTTPClient', () => {
        let getHTTPClient: (typeof CrowdSecClient)['getHTTPClient'];
        const mockAddAxiosDebugInterceptors = jest.fn();
        beforeEach(() => {
            // @ts-ignore
            FakeClient.prototype.addAxiosDebugInterceptors = mockAddAxiosDebugInterceptors;
            // @ts-ignore
            getHTTPClient = FakeClient.getHTTPClient.bind(FakeClient.prototype);
        });
        it('should return axiosInstance', async () => {
            mockAddAxiosDebugInterceptors.mockImplementationOnce(() => 'fake instance');
            expect(
                getHTTPClient({
                    url: 'https://crowdsec.lan'
                })
            ).toBe('fake instance');

            expect(mockAxios.create).toHaveBeenCalledWith({
                baseURL: 'https://crowdsec.lan',
                headers: { 'User-Agent': 'node-test-crowdsec/v1.0.0' },
                httpsAgent: undefined,
                timeout: 2000
            });

            expect(mockAddAxiosDebugInterceptors).toHaveBeenCalledWith(mockAxios);
        });
        it('should remove trailing slash on url', async () => {
            mockAddAxiosDebugInterceptors.mockImplementationOnce(() => 'fake instance');
            getHTTPClient({
                url: 'https://crowdsec.lan/'
            });

            expect(mockAxios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    baseURL: 'https://crowdsec.lan'
                })
            );
        });
        it('should throw error without url', async () => {
            expect.assertions(4);
            try {
                // @ts-ignore
                getHTTPClient({});
            } catch (e) {
                expect(e).toBeInstanceOf(CrowdsecClientError);
                const err = e as CrowdsecClientError;
                expect(err.message).toBe('options.url is needed to create a crowdsec client');
            }

            expect(mockAxios.create).not.toHaveBeenCalled();
            expect(mockAddAxiosDebugInterceptors).not.toHaveBeenCalled();
        });
        it('should pass custom https agent if strictSSL is disabled', async () => {
            mockAddAxiosDebugInterceptors.mockImplementationOnce(() => 'fake instance');
            getHTTPClient({
                url: 'https://crowdsec.lan/',
                strictSSL: false
            });

            expect(mockAxios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    httpsAgent: expect.any(https.Agent)
                })
            );
        });
    });

    describe('functions', () => {
        let mockGetHTTPClient: jest.Spied<any>;
        beforeEach(() => {
            // @ts-ignore
            mockGetHTTPClient = jest.spyOn(CrowdSecClient, 'getHTTPClient').mockImplementation(() => mockAxios);
        });
        afterEach(() => {
            mockGetHTTPClient.mockRestore();
        });
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
