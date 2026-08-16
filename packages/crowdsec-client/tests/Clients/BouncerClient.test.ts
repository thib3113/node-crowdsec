import { beforeEach, describe, expect, vi, it } from 'vitest';
import type { BouncerClient as BouncerClientType } from '../../src/Clients/BouncerClient.js';
import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';

const { mockCrowdSecClientConstructor, FakeClient, mockDecisionsBouncer } = vi.hoisted(() => {
    const mockCrowdSecClientConstructor = vi.fn();
    class FakeClient {
        setAuthenticationHeaders = vi.fn();
        setAuthenticationByTLS = vi.fn();
        _testConnection = vi.fn();
        // @ts-ignore
        constructor(...args) {
            mockCrowdSecClientConstructor(...args);
        }
        http = 'fake-http';
        static getHTTPClient: unknown;
    }

    const mockDecisionsBouncer = vi.fn();

    return { mockCrowdSecClientConstructor, FakeClient, mockDecisionsBouncer };
});

vi.mock('../../src/Clients/CrowdSecClient.js', () => ({
    CrowdSecClient: FakeClient
}));

vi.mock('../../src/Decisions/DecisionsBouncer.js', () => ({
    DecisionsBouncer: mockDecisionsBouncer
}));

const { BouncerClient } = await import('../../src/Clients/BouncerClient.js');

describe('BouncerClient.test.ts', () => {
    describe('constructor', () => {
        it('should construct with apiKey', async () => {
            const client = new BouncerClient({
                url: 'test-url',
                auth: {
                    apiKey: 'test-apiKey'
                }
            });

            expect(mockCrowdSecClientConstructor).toHaveBeenCalledWith(expect.objectContaining({ url: 'test-url' }));
            // @ts-ignore
            expect(client.setAuthenticationHeaders).toHaveBeenCalledWith({
                'X-Api-Key': 'test-apiKey'
            });
            expect(mockDecisionsBouncer).toHaveBeenCalledWith({ httpClient: client.http });
        });
        it('should construct with certificate', async () => {
            const client = new BouncerClient({
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
                new BouncerClient();
            } catch (e) {
                expect(e).toBeInstanceOf(CrowdsecClientError);
                const err = e as CrowdsecClientError;
                expect(err.message).toBe('options.auth is needed when creating a bouncer client');
            }

            expect(mockCrowdSecClientConstructor).toHaveBeenCalledWith(undefined);
        });
    });
    describe('functions', () => {
        const httpGetMock = vi.fn();
        let bouncer: BouncerClientType;
        beforeEach(async () => {
            bouncer = new BouncerClient({
                // @ts-ignore
                auth: {},
                url: ''
            });
            // @ts-ignore
            bouncer.http = { get: httpGetMock };
        });

        describe('login', () => {
            it('should call the testConnection', async () => {
                const mockTestConnection = vi.fn();
                // @ts-ignore
                bouncer.testConnection = mockTestConnection;

                await bouncer.login();

                expect(mockTestConnection).toHaveBeenCalledWith();
            });
        });
        describe('testConnection', () => {
            it('should call the parent testConnection', async () => {
                await bouncer.testConnection();

                // @ts-ignore
                expect(bouncer._testConnection).toHaveBeenCalledWith('/v1/decisions');
            });
        });
        describe('stop', () => {
            it('should call the Decisions stop', async () => {
                const mockDecisionsStrop = vi.fn();
                // @ts-ignore
                bouncer.Decisions = {
                    stop: mockDecisionsStrop
                };

                await bouncer.stop();

                // @ts-ignore
                expect(mockDecisionsStrop).toHaveBeenCalledWith();
            });
        });
    });
});