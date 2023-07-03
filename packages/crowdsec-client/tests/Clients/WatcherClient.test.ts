import { beforeEach, describe, expect, jest, it, afterEach } from '@jest/globals';
import type { WatcherClient as WatcherClientType } from '../../src/Clients/WatcherClient.js';
import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';
import { EErrorsCodes } from '../../src/Errors/EErrorsCodes.js';
import { mock } from 'node:test';

const mockDebug = jest.fn();
const mockDebugExtend = jest.fn().mockImplementation(() => mockDebug);
const createDebuggerMock = jest.fn().mockImplementation(() => mockDebug);

const getFakeTimeout = () => {
    //check if fakeTimeout is cleared by checking if mockTimeoutCleared is called
    const mockTimeoutCleared = jest.fn();
    const fakeTimeout = {};
    //works with node <20 ?
    Object.defineProperty(fakeTimeout, '_onTimeout', {
        get: () => true,
        set(v: any) {
            mockTimeoutCleared(v);
        }
    });

    return [fakeTimeout, mockTimeoutCleared];
};

// @ts-ignore
mockDebug.extend = mockDebugExtend;
jest.unstable_mockModule('../../src/utils.js', () => ({
    createDebugger: createDebuggerMock
}));

const mockDecisionsWatcher = jest.fn();
jest.unstable_mockModule('../../src/Decisions/DecisionsWatcher.js', () => ({
    DecisionsWatcher: mockDecisionsWatcher
}));
const mockAlerts = jest.fn();
jest.unstable_mockModule('../../src/Alerts/Alerts.js', () => ({
    Alerts: mockAlerts
}));

const mockCrowdSecClientConstructor = jest.fn();
class FakeClient {
    setAuthenticationHeaders = jest.fn();
    setAuthenticationByTLS = jest.fn();
    _testConnection = jest.fn();
    // @ts-ignore
    constructor(...args) {
        mockCrowdSecClientConstructor(...args);
    }
    http = 'fake-http';
}

jest.unstable_mockModule('../../src/Clients/CrowdSecClient.js', () => ({
    CrowdSecClient: FakeClient
}));

const { WatcherClient } = await import('../../src/Clients/WatcherClient.js');

describe('WatcherClient.test.ts', () => {
    describe('constructor', () => {
        it('should construct with machine_id / password', async () => {
            const client = new WatcherClient({
                url: 'test-url',
                auth: {
                    machineID: 'machine_id',
                    password: 'password'
                }
            });

            const mockPost = jest.fn();

            // @ts-ignore
            client.http = {
                post: mockPost
            };
            mockPost.mockImplementation(() => {
                throw new Error('fake-error');
            });
            // @ts-ignore
            await expect(() => client._login()).rejects.toThrow('fake-error');

            expect(mockPost).toHaveBeenCalledWith(
                '/v1/watchers/login',
                expect.objectContaining({ machine_id: 'machine_id', password: 'password' })
            );
        });
        it('should construct with certificate', async () => {
            const client = new WatcherClient({
                url: 'test-url',
                auth: {
                    key: 'test-key',
                    cert: 'test-cert',
                    ca: 'test-ca'
                }
            });

            expect(mockCrowdSecClientConstructor).toHaveBeenCalledWith(expect.objectContaining({ url: 'test-url' }));
            // @ts-ignore
            expect(client.setAuthenticationByTLS).toHaveBeenCalledWith({
                key: 'test-key',
                cert: 'test-cert',
                ca: 'test-ca'
            });
        });
        it('should throw an error if construct without authentication', async () => {
            expect.assertions(3);
            try {
                // @ts-ignore
                new WatcherClient();
            } catch (e) {
                expect(e).toBeInstanceOf(CrowdsecClientError);
                const err = e as CrowdsecClientError;
                expect(err.message).toBe('options.auth is needed when creating a watcher client');
            }

            expect(mockCrowdSecClientConstructor).toHaveBeenCalledWith(undefined);
        });
    });
    describe('functions', () => {
        const httpGetMock = jest.fn();
        const httpPostMock = jest.fn();
        let watcher: WatcherClientType;
        beforeEach(async () => {
            watcher = new WatcherClient({
                auth: {
                    machineID: 'test_machine_id',
                    password: 'test_password'
                },
                url: ''
            });
            // @ts-ignore
            watcher.http = { get: httpGetMock, post: httpPostMock };
        });

        describe('login', () => {
            const mockTestConnection = jest.fn();
            const mockLogin = jest.fn();
            const mockHeartbeatLoop = jest.fn<() => Promise<void>>().mockResolvedValue();
            beforeEach(() => {
                // @ts-ignore
                watcher.testConnection = mockTestConnection;
                // @ts-ignore
                watcher._login = mockLogin;
                // @ts-ignore
                watcher.heartbeatLoop = mockHeartbeatLoop;
            });
            it('should call login', async () => {
                mockLogin.mockImplementationOnce(() => Promise.resolve());
                await watcher.login();

                expect(mockLogin).toHaveBeenCalledWith();
                expect(mockHeartbeatLoop).toHaveBeenCalledWith();
                expect(mockTestConnection).toHaveBeenCalledWith();
            });
            it('should call skip heartLoop if disabled', async () => {
                mockLogin.mockImplementationOnce(() => Promise.resolve());
                // @ts-ignore
                watcher.heartbeat = false;
                await watcher.login();

                expect(mockHeartbeatLoop).not.toHaveBeenCalled();

                expect(mockLogin).toHaveBeenCalledWith();
                expect(mockTestConnection).toHaveBeenCalledWith();
            });
            it('should handle heartLoop crashed', async () => {
                mockLogin.mockImplementationOnce(() => {});
                mockHeartbeatLoop.mockImplementationOnce(() => Promise.reject('heartLoop crash'));
                await watcher.login();

                expect(mockDebug).toHaveBeenCalledWith('uncatched error from starting heartbeatLoop : %o', 'heartLoop crash');

                expect(mockHeartbeatLoop).toHaveBeenCalled();

                expect(mockLogin).toHaveBeenCalledWith();
                expect(mockTestConnection).toHaveBeenCalledWith();
            });
        });
        describe('testConnection', () => {
            it('should call the parent testConnection', async () => {
                await watcher.testConnection();

                // @ts-ignore
                expect(watcher._testConnection).toHaveBeenCalledWith('/v1/alerts');
            });
        });

        describe('_login', () => {
            let _login: WatcherClientType['_login'];
            const oldSetTimeout = setTimeout;
            const mockSetTimeout = jest.fn();
            const mockSetAuthenticationHeaders = jest.fn();
            beforeEach(() => {
                // @ts-ignore
                _login = watcher._login.bind(watcher);
                // @ts-ignore
                setTimeout = mockSetTimeout;

                // @ts-ignore
                watcher.setAuthenticationHeaders = mockSetAuthenticationHeaders;
            });

            afterEach(() => {
                // @ts-ignore
                setTimeout = oldSetTimeout;
            });
            it('should log in with machineId and password', async () => {
                httpPostMock.mockImplementationOnce(() => ({
                    data: {
                        token: 'test_token',
                        expire: 'test_expire'
                    }
                }));
                // @ts-ignore
                watcher.auth.autoRenew = false;
                await _login();

                expect(httpPostMock).toHaveBeenCalledWith('/v1/watchers/login', {
                    machine_id: 'test_machine_id',
                    password: 'test_password',
                    scenarios: []
                });
                expect(mockSetAuthenticationHeaders).toHaveBeenCalledWith(expect.objectContaining({ Authorization: `Bearer test_token` }));
            });
            it('should log in with tls', async () => {
                watcher = new WatcherClient({
                    auth: {
                        key: 'test_key',
                        cert: 'test_cert',
                        ca: 'test_ca'
                    },
                    url: ''
                });
                // @ts-ignore
                watcher.http = { get: httpGetMock, post: httpPostMock };

                httpPostMock.mockImplementationOnce(() => ({
                    data: {
                        token: 'test_token',
                        expire: 'test_expire'
                    }
                }));
                await _login();
                expect(httpPostMock).toHaveBeenCalledWith('/v1/watchers/login', {
                    machine_id: 'test_machine_id',
                    password: 'test_password',
                    scenarios: []
                });
                expect(mockSetAuthenticationHeaders).toHaveBeenCalledWith(expect.objectContaining({ Authorization: `Bearer test_token` }));
                expect(mockSetTimeout).toHaveBeenCalled();
            });
            it('should log clear autorenew', async () => {
                const [timeout, mockTimeout] = getFakeTimeout();
                // @ts-ignore
                watcher.autoRenewTimeout = timeout;

                httpPostMock.mockImplementationOnce(() => ({
                    data: {
                        token: 'test_token',
                        expire: 'test_expire'
                    }
                }));
                // @ts-ignore
                watcher.auth.autoRenew = false;
                await _login();

                expect(mockTimeout).toHaveBeenCalled();
                expect(httpPostMock).toHaveBeenCalledWith('/v1/watchers/login', {
                    machine_id: 'test_machine_id',
                    password: 'test_password',
                    scenarios: []
                });
                expect(mockSetAuthenticationHeaders).toHaveBeenCalledWith(expect.objectContaining({ Authorization: `Bearer test_token` }));
            });
            it("should throw if http answer doesn't contain a token", async () => {
                httpPostMock.mockImplementationOnce(() => ({
                    data: {
                        token: '',
                        expire: 'test_expire'
                    }
                }));
                // @ts-ignore
                watcher.auth.autoRenew = false;
                expect.assertions(5);
                try {
                    await _login();
                } catch (e) {
                    expect(e).toBeInstanceOf(CrowdsecClientError);
                    const err = e as CrowdsecClientError;
                    expect(err.message).toBe('fail to get token');
                    expect(err.code).toBe(EErrorsCodes.CONNECTION_FAILED);
                }

                expect(httpPostMock).toHaveBeenCalledWith('/v1/watchers/login', {
                    machine_id: 'test_machine_id',
                    password: 'test_password',
                    scenarios: []
                });
                expect(mockSetAuthenticationHeaders).not.toHaveBeenCalled();
            });
            it("should throw if http answer doesn't contain an expire", async () => {
                httpPostMock.mockImplementationOnce(() => ({
                    data: {
                        token: 'test_token',
                        expire: ''
                    }
                }));
                // @ts-ignore
                watcher.auth.autoRenew = false;
                expect.assertions(5);
                try {
                    await _login();
                } catch (e) {
                    expect(e).toBeInstanceOf(CrowdsecClientError);
                    const err = e as CrowdsecClientError;
                    expect(err.message).toBe('fail to get token');
                    expect(err.code).toBe(EErrorsCodes.CONNECTION_FAILED);
                }

                expect(httpPostMock).toHaveBeenCalledWith('/v1/watchers/login', {
                    machine_id: 'test_machine_id',
                    password: 'test_password',
                    scenarios: []
                });
                expect(mockSetAuthenticationHeaders).not.toHaveBeenCalled();
            });
            it('should recall login to renew token', async () => {
                const timeout = 10 * 60 * 1000;
                httpPostMock.mockImplementationOnce(() => ({
                    data: {
                        token: 'test_token',
                        expire: Date.now() + timeout
                    }
                }));
                // @ts-ignore
                watcher.auth.autoRenew = true;
                await _login();

                //check if the timeout FN call login
                expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
                // @ts-ignore
                const [timeOutFn, nbTimeout] = mockSetTimeout.mock.calls[0];

                expect(nbTimeout).toBeLessThanOrEqual(timeout - 5 * 60);

                expect(timeOutFn).toBeDefined();
                const mockTimeoutLoop = jest.fn().mockImplementationOnce(() => Promise.resolve());
                // @ts-ignore
                watcher._login = mockTimeoutLoop;
                // @ts-ignore
                timeOutFn();

                expect(mockTimeoutLoop).toHaveBeenCalledWith();

                mockTimeoutLoop.mockClear();

                await new Promise((resolve) => {
                    mockTimeoutLoop.mockImplementationOnce(() => {
                        setImmediate(resolve);
                        return Promise.reject('aaaa');
                    });
                    // @ts-ignore
                    timeOutFn();
                });

                expect(mockDebug).toHaveBeenCalledWith('uncatched error in _login %o', 'aaaa');
            });
        });

        describe('stop', () => {
            it('should clear the heartbeatTimeout timeout', async () => {
                const [timeout, mock] = getFakeTimeout();
                // @ts-ignore
                watcher.heartbeatTimeout = timeout;
                await watcher.stop();

                // @ts-ignore
                expect(mock).toHaveBeenCalled();
            });
            it('should clear the autoRenewTimeout timeout', async () => {
                const [timeout, mock] = getFakeTimeout();
                // @ts-ignore
                watcher.autoRenewTimeout = timeout;

                await watcher.stop();

                // @ts-ignore
                expect(mock).toHaveBeenCalled();
            });
        });

        describe('registerWatcher', () => {
            it('should call register watcher endpoint', async () => {
                httpPostMock.mockImplementationOnce(() =>
                    Promise.resolve({
                        data: {}
                    })
                );
                await watcher.registerWatcher({
                    machine_id: 'test_machine_id',
                    password: 'test_password'
                });

                expect(httpPostMock).toHaveBeenCalledWith('/v1/watchers', { machine_id: 'test_machine_id', password: 'test_password' });
            });
        });
        describe('heartbeatLoop', () => {
            let heartbeatLoop: WatcherClientType['heartbeatLoop'];
            const oldSetTimeout = setTimeout;
            const mockSetTimeout = jest.fn();
            beforeEach(() => {
                // @ts-ignore
                heartbeatLoop = watcher.heartbeatLoop.bind(watcher);
                // @ts-ignore
                setTimeout = mockSetTimeout;
            });

            afterEach(() => {
                // @ts-ignore
                setTimeout = oldSetTimeout;
            });
            it('should clear timeout heartbeatLoop', async () => {
                const [timeout, mockTimeout] = getFakeTimeout();
                // @ts-ignore
                watcher.heartbeatTimeout = timeout;

                httpGetMock.mockImplementationOnce(() => {});
                await heartbeatLoop();

                expect(mockTimeout).toHaveBeenCalled();
                expect(httpGetMock).toHaveBeenCalledWith('/v1/heartbeat');
            });
            it('should setTimeout to loop from heartbeat', async () => {
                httpGetMock.mockImplementationOnce(() => {});
                // @ts-ignore
                watcher.heartbeat = 5000;
                await heartbeatLoop();

                expect(httpGetMock).toHaveBeenCalledWith('/v1/heartbeat');

                expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
            });
            it('should setTimeout to loop', async () => {
                httpGetMock.mockImplementationOnce(() => {});
                await heartbeatLoop();

                expect(httpGetMock).toHaveBeenCalledWith('/v1/heartbeat');

                expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30000);
            });
            it('should debug error in loop', async () => {
                httpGetMock.mockImplementationOnce(() => Promise.reject('fake-error'));
                await heartbeatLoop();

                expect(mockDebug).toHaveBeenCalledWith('error %o', 'fake-error');
            });
            it('should recall heartbeat', async () => {
                const [timeout, mockTimeout] = getFakeTimeout();
                // @ts-ignore
                watcher.heartbeatTimeout = timeout;

                httpGetMock.mockImplementationOnce(() => {});
                await heartbeatLoop();

                //check if the timeout FN call login
                expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
                // @ts-ignore
                const timeOutFn = mockSetTimeout.mock.calls[0][0];

                expect(timeOutFn).toBeDefined();
                const mockTimeoutLoop = jest.fn().mockImplementationOnce(() => Promise.resolve());
                // @ts-ignore
                watcher.heartbeatLoop = mockTimeoutLoop;
                // @ts-ignore
                timeOutFn();

                expect(mockTimeoutLoop).toHaveBeenCalledWith();

                mockTimeoutLoop.mockClear();

                await new Promise((resolve) => {
                    mockTimeoutLoop.mockImplementationOnce(() => {
                        setImmediate(resolve);
                        return Promise.reject('aaaa');
                    });
                    // @ts-ignore
                    timeOutFn();
                });

                expect(mockTimeout).toHaveBeenCalled();
                expect(httpGetMock).toHaveBeenCalledWith('/v1/heartbeat');
            });
        });
    });

    describe('static registerWatcher', () => {
        it('should call register watcher endpoint', async () => {
            const mockPost = jest.fn().mockImplementationOnce(() => ({ data: {} }));
            const mockGetHTTPClient = jest.fn().mockImplementation(() => ({ post: mockPost }));
            // @ts-ignore
            FakeClient.getHTTPClient = mockGetHTTPClient;

            await WatcherClient.registerWatcher({
                machine_id: 'test_machine_id',
                password: 'test_password',
                url: 'https://localhost:8080'
            });

            expect(mockGetHTTPClient).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://localhost:8080' }));
            expect(mockPost).toHaveBeenCalledWith('/v1/watchers', {
                machine_id: 'test_machine_id',
                password: 'test_password'
            });
        });
    });
});
