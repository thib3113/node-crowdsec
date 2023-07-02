import { beforeEach, describe, expect, jest, it } from '@jest/globals';
import type { WatcherClient as WatcherClientType } from '../../src/Clients/WatcherClient.js';
import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';

const mockDebug = jest.fn();
const mockDebugExtend = jest.fn().mockImplementation(() => mockDebug);
const createDebuggerMock = jest.fn().mockImplementation(() => mockDebug);

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
        let watcher: WatcherClientType;
        beforeEach(async () => {
            watcher = new WatcherClient({
                // @ts-ignore
                auth: {},
                url: ''
            });
            // @ts-ignore
            watcher.http = { get: httpGetMock };
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
        // describe('stop', () => {
        //     it('should call the Decisions stop', async () => {
        //         const mockDecisionsStrop = jest.fn();
        //         // @ts-ignore
        //         watcher.Decisions = {
        //             stop: mockDecisionsStrop
        //         };
        //
        //         await watcher.stop();
        //
        //         // @ts-ignore
        //         expect(mockDecisionsStrop).toHaveBeenCalledWith();
        //     });
        // });
    });
});
