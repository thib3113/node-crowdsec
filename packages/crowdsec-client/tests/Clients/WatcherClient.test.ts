import { beforeEach, describe, expect, jest, it, afterEach } from '@jest/globals';
import type { WatcherClient as WatcherClientType } from '../../src/Clients/WatcherClient.js';
import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';

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

const mockDecisionsBouncer = jest.fn();
jest.unstable_mockModule('../../src/Decisions/DecisionsBouncer.js', () => ({
    DecisionsBouncer: mockDecisionsBouncer
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
            const mockHeartbeatLoop = jest.fn();
            afterEach(() => {});
            it('should call the testConnection', async () => {
                // @ts-ignore
                watcher.testConnection = mockTestConnection;
                // @ts-ignore
                watcher._login = mockLogin;

                await watcher.login();

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
