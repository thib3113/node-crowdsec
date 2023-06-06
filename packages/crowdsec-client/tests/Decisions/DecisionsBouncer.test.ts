import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { DecisionsBouncer } from '../../src/Decisions/DecisionsBouncer.js';
import type { DecisionsStream } from '../../src/Decisions/DecisionsStream.js';
import Mock = jest.Mock;

const mockDebug = jest.fn();
const mockDebugExtend = jest.fn().mockImplementation(() => mockDebug);
const createDebuggerMock = jest.fn().mockImplementation(() => mockDebug);
// @ts-ignore
mockDebug.extend = mockDebugExtend;

const mockParseExpiration = jest.fn().mockReturnValue(new Date('2023-06-01T17:41:26.499Z'));
const mockForceArray = jest.fn().mockImplementation((p) => (Array.isArray(p) ? p : [p]));
jest.unstable_mockModule('../../src/utils.js', () => ({
    parseExpiration: mockParseExpiration,
    createDebugger: createDebuggerMock,
    forceArray: mockForceArray
}));
jest.unstable_mockModule('../../src/BaseSubObject.js', () => ({ BaseSubObject: jest.fn() }));

const mockStreamOnce = jest.fn();
const mockStreamOn = jest.fn();
const mockResume = jest.fn();
const mockDecisionStream = {
    once: mockStreamOnce,
    on: mockStreamOn,
    resume: mockResume
};
const mockDecisionStreamConstructor = jest.fn().mockReturnValue(mockDecisionStream);
jest.unstable_mockModule('../../src/Decisions/DecisionsStream.js', () => ({
    DecisionsStream: mockDecisionStreamConstructor
}));

describe('DecisionsBouncer', () => {
    const httpGetMock = jest.fn();
    let bouncer: DecisionsBouncer;
    beforeEach(async () => {
        const res = await import('../../src/Decisions/DecisionsBouncer.js');
        // @ts-ignore
        bouncer = new res.DecisionsBouncer();
        // @ts-ignore
        bouncer.http = { get: httpGetMock };
    });
    afterEach(() => {
        httpGetMock.mockReset();
    });

    describe('getStreamLoop', () => {
        let getStreamLoop: DecisionsBouncer['getStreamLoop'];

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

        const mockGetRawStream = jest.fn().mockImplementation(() => Promise.resolve());
        const mockSetTimeout = jest.fn();

        let localDecisionStream: DecisionsStream;
        const oldSetTimeout = setTimeout;
        beforeEach(() => {
            // @ts-ignore
            setTimeout = mockSetTimeout;

            localDecisionStream = {
                paused: true,
                emit: jest.fn(),
                push: jest.fn()
            } as unknown as DecisionsStream;

            // @ts-ignore
            getStreamLoop = bouncer.getStreamLoop.bind(bouncer);

            // @ts-ignore
            bouncer.getRawStream = mockGetRawStream;
        });
        afterEach(() => {
            // jest.useRealTimers();
            // @ts-ignore
            setTimeout = oldSetTimeout;
            mockTimeoutCleared.mockRestore();
        });

        it('should call getRawStream in loop when not paused', async () => {
            // @ts-ignore
            localDecisionStream.paused = false;
            const interval = 2;
            const options = {};

            mockSetTimeout.mockReturnValue('fakeTimeout');

            // @ts-ignore
            expect(bouncer.getStreamTimeout).not.toBeDefined();

            await getStreamLoop(options, localDecisionStream, interval);

            // @ts-ignore
            expect(bouncer.getStreamTimeout).toBe('fakeTimeout');

            expect(mockGetRawStream).toHaveBeenCalledWith({});
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), interval);

            //check if the timeout FN call the loop
            // @ts-ignore
            const timeOutFn = (global.setTimeout as Mock).mock.calls[0][0];
            expect(timeOutFn).toBeDefined();
            const mockTimeoutLoop = jest.fn().mockImplementation(() => Promise.resolve());
            // @ts-ignore
            bouncer.getStreamLoop = mockTimeoutLoop;
            // @ts-ignore
            timeOutFn();

            expect(mockTimeoutLoop).toHaveBeenCalledWith({ ...options, startup: false }, localDecisionStream, interval);
        });
        it('should clearTimeout if always waiting', async () => {
            // @ts-ignore
            localDecisionStream.paused = false;
            const interval = 2;
            const options = {};
            // @ts-ignore
            bouncer.getStreamTimeout = fakeTimeout;

            await getStreamLoop(options, localDecisionStream, interval);

            expect(mockTimeoutCleared).toHaveBeenCalled();
            expect(mockGetRawStream).toHaveBeenCalledWith({});
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), interval);
        });
        it('should close the loop if paused', async () => {
            // @ts-ignore
            localDecisionStream.paused = true;
            const interval = 2;
            const options = {};

            await getStreamLoop(options, localDecisionStream, interval);

            expect(mockGetRawStream).toHaveBeenCalledWith({});
            expect(global.setTimeout).not.toHaveBeenCalled();
        });
        it('should emit error if getRawStream throw', async () => {
            // @ts-ignore
            localDecisionStream.paused = true;
            const interval = 2;
            const options = {};

            const fakeError = new Error('fake');

            mockGetRawStream.mockImplementationOnce(() => {
                throw fakeError;
            });

            await getStreamLoop(options, localDecisionStream, interval);

            expect(mockGetRawStream).toHaveBeenCalledWith({});
            expect(global.setTimeout).not.toHaveBeenCalled();

            expect(localDecisionStream.emit).toHaveBeenCalledWith('error', fakeError);
        });
    });
    describe('streamToCallback', () => {
        let streamToCallback: DecisionsBouncer['streamToCallback'];
        beforeEach(() => {
            // @ts-ignore
            streamToCallback = bouncer.streamToCallback.bind(bouncer);
        });

        it('should handle added event', async () => {
            const fakeDecision = {
                foo: 'bar'
            };
            const mockCB = jest.fn();
            // @ts-ignore
            streamToCallback(mockDecisionStream, mockCB);
            expect(mockResume).toHaveBeenCalled();
            expect(mockCB).not.toHaveBeenCalled();

            expect(mockDecisionStream.on).toHaveBeenCalledWith('added', expect.any(Function));

            //get the added listener
            // @ts-ignore
            const onAddedFn = mockDecisionStream.on.mock.calls.find(([type]) => type === 'added')[1] as Function;
            expect(onAddedFn).toBeDefined();

            onAddedFn(fakeDecision);

            expect(mockCB).toHaveBeenCalledWith(null, {
                decision: fakeDecision,
                type: 'added'
            });
        });
        it('should handle deleted event', async () => {
            const fakeDecision = {
                foo: 'bar'
            };
            const mockCB = jest.fn();
            // @ts-ignore
            streamToCallback(mockDecisionStream, mockCB);
            expect(mockResume).toHaveBeenCalled();
            expect(mockCB).not.toHaveBeenCalled();

            expect(mockDecisionStream.on).toHaveBeenCalledWith('deleted', expect.any(Function));

            //get the deleted listener
            // @ts-ignore
            const onAddedFn = mockDecisionStream.on.mock.calls.find(([type]) => type === 'deleted')[1] as Function;
            expect(onAddedFn).toBeDefined();

            onAddedFn(fakeDecision);

            expect(mockCB).toHaveBeenCalledWith(null, {
                decision: fakeDecision,
                type: 'deleted'
            });
        });
        it('should handle error event', async () => {
            const fakeError = new Error('fake');
            const mockCB = jest.fn();
            // @ts-ignore
            streamToCallback(mockDecisionStream, mockCB);
            expect(mockResume).toHaveBeenCalled();
            expect(mockCB).not.toHaveBeenCalled();

            expect(mockDecisionStream.on).toHaveBeenCalledWith('error', expect.any(Function));

            //get the error listener
            // @ts-ignore
            const onAddedFn = mockDecisionStream.on.mock.calls.find(([type]) => type === 'error')[1] as Function;
            expect(onAddedFn).toBeDefined();

            onAddedFn(fakeError);

            expect(mockCB).toHaveBeenCalledWith(fakeError);
        });
    });
    describe('search', () => {
        it('should search with full options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.search({
                    scope: 'ip',
                    value: '1.2.3.4',
                    type: 'ban',
                    ip: '1.2.3.4',
                    range: '1.2.3.4/32',
                    contains: true,
                    origins: 'cscli, crowdsec',
                    scenarios_containing: 'test1, test2',
                    scenarios_not_containing: 'test1, test2'
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: 'ip',
                    value: '1.2.3.4',
                    type: 'ban',
                    ip: '1.2.3.4',
                    range: '1.2.3.4/32',
                    contains: true,
                    origins: 'cscli, crowdsec',
                    scenarios_containing: 'test1, test2',
                    scenarios_not_containing: 'test1, test2'
                }
            });
        });
        it('should search without options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(await bouncer.search()).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {}
            });
        });
        it('should search with other options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.search({
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: '',
                    scenarios_containing: '',
                    scenarios_not_containing: ''
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: undefined,
                    scenarios_containing: undefined,
                    scenarios_not_containing: undefined
                }
            });
        });
        it('should search with arrays', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.search({
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: ['1', '2', '3'],
                    scenarios_containing: ['1', '2', '3'],
                    scenarios_not_containing: ['1', '2', '3']
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: '1,2,3',
                    scenarios_containing: '1,2,3',
                    scenarios_not_containing: '1,2,3'
                }
            });
        });
        it('should return nothing', async () => {
            httpGetMock.mockImplementationOnce(() => ({}));

            expect(
                await bouncer.search({
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: ['1', '2', '3'],
                    scenarios_containing: ['1', '2', '3'],
                    scenarios_not_containing: ['1', '2', '3']
                })
            ).toStrictEqual([]);

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: '1,2,3',
                    scenarios_containing: '1,2,3',
                    scenarios_not_containing: '1,2,3'
                }
            });
        });
    });
    describe('getStream', () => {
        const getStreamListeners = (mocks: Array<Mock>): Record<'close' | 'pause' | 'resume' | 'error', Function> => {
            const listeners: Record<string, Function> = {};
            mocks.forEach(({ mock }) =>
                mock.calls.forEach(([event, cb]) => {
                    listeners[event as string] = cb as Function;
                })
            );

            ['close', 'pause', 'resume', 'error'].forEach((evt) => {
                if (!listeners[evt]) {
                    throw new Error(`listener for event ${evt} is missing`);
                }
            });

            return listeners;
        };
        const mockGetStreamLoop = jest.fn().mockImplementation(() => Promise.resolve());
        beforeEach(() => {
            // @ts-ignore
            bouncer.getStreamLoop = mockGetStreamLoop;
        });

        it('should generate a stream', async () => {
            const params = {
                scopes: 'ip',
                interval: 2000,
                origins: 'cscli',
                scenarios_containing: 'test',
                scenarios_not_containing: 'test2'
            };

            expect(await bouncer.getStream(params)).toBe(mockDecisionStream);

            const { resume } = getStreamListeners([mockStreamOn, mockStreamOnce]);
            resume();
            expect(
                mockGetStreamLoop({
                    ...params,
                    startup: true
                })
            );
            resume();
            mockGetStreamLoop({
                ...params,
                startup: false
            });

            expect(mockDecisionStreamConstructor).toHaveBeenCalledWith(expect.any(String));
            expect(mockStreamOnce).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('resume', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('error', expect.any(Function));
        });
        it('should generate a stream with less options', async () => {
            const params = {
                scopes: 'ip'
            };
            expect(await bouncer.getStream(params)).toBe(mockDecisionStream);

            const { resume } = getStreamListeners([mockStreamOn, mockStreamOnce]);
            resume();
            expect(
                mockGetStreamLoop({
                    ...params,
                    startup: true
                })
            );
            resume();
            mockGetStreamLoop({
                ...params,
                startup: false
            });

            expect(mockDecisionStreamConstructor).toHaveBeenCalledWith(expect.any(String));
            expect(mockStreamOnce).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('resume', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('error', expect.any(Function));
        });
        it('should generate a stream without options', async () => {
            const params = undefined;
            expect(await bouncer.getStream(params)).toBe(mockDecisionStream);

            const { resume } = getStreamListeners([mockStreamOn, mockStreamOnce]);
            resume();
            expect(
                mockGetStreamLoop({
                    startup: true
                })
            );
            resume();
            mockGetStreamLoop({
                startup: false
            });

            expect(mockDecisionStreamConstructor).toHaveBeenCalledWith(expect.any(String));
            expect(mockStreamOnce).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('resume', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('error', expect.any(Function));
        });
        it('should generate a stream with other options', async () => {
            const params = {
                scopes: 'ip',
                interval: 2000,
                origins: 'cscli, test5',
                scenarios_containing: 'test, test5',
                scenarios_not_containing: 'test2, test5'
            };
            expect(await bouncer.getStream(params)).toBe(mockDecisionStream);

            const { resume } = getStreamListeners([mockStreamOn, mockStreamOnce]);
            resume();
            expect(
                mockGetStreamLoop({
                    ...params,
                    startup: true
                })
            );
            resume();
            mockGetStreamLoop({
                ...params,
                startup: false
            });

            expect(mockDecisionStreamConstructor).toHaveBeenCalledWith(expect.any(String));
            expect(mockStreamOnce).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('resume', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('error', expect.any(Function));
        });
        it('should generate a stream with array options', async () => {
            const params = {
                scopes: ['ip'],
                interval: 2000,
                origins: ['cscli', 'test5'],
                scenarios_containing: ['test', 'test5'],
                scenarios_not_containing: ['test2', 'test5']
            };

            expect(await bouncer.getStream(params)).toBe(mockDecisionStream);

            const { resume } = getStreamListeners([mockStreamOn, mockStreamOnce]);
            resume();
            expect(
                mockGetStreamLoop({
                    ...params,
                    startup: true
                })
            );
            resume();
            mockGetStreamLoop({
                ...params,
                startup: false
            });

            expect(mockDecisionStreamConstructor).toHaveBeenCalledWith(expect.any(String));
            expect(mockStreamOnce).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('resume', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('error', expect.any(Function));
        });
        it('should generate a stream and call function to handle cb', async () => {
            const mockCB = jest.fn();
            const mockStreamToCallback = jest.fn();
            // @ts-ignore
            bouncer.streamToCallback = mockStreamToCallback;

            const params = undefined;

            expect(await bouncer.getStream(params, mockCB)).toBe(mockDecisionStream);

            const { resume } = getStreamListeners([mockStreamOn, mockStreamOnce]);
            resume();
            expect(
                mockGetStreamLoop({
                    startup: true
                })
            );
            resume();
            mockGetStreamLoop({
                startup: false
            });

            expect(mockStreamToCallback).toHaveBeenCalledWith(mockDecisionStream, mockCB);

            expect(mockDecisionStreamConstructor).toHaveBeenCalledWith(expect.any(String));
            expect(mockStreamOnce).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('resume', expect.any(Function));
            expect(mockStreamOn).toHaveBeenCalledWith('error', expect.any(Function));
        });

        describe('stream events', () => {
            let listeners: Record<string, Function> = {};

            const mockTimeoutCleared = jest.fn();
            const fakeTimeout = {};
            //works with node <20 ?
            Object.defineProperty(fakeTimeout, '_onTimeout', {
                get: () => true,
                set(v: any) {
                    mockTimeoutCleared(v);
                }
            });

            beforeEach(async () => {
                await bouncer.getStream();
                listeners = getStreamListeners([mockStreamOn, mockStreamOnce]);
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it('should handle the close listener', async () => {
                // @ts-ignore
                bouncer.getStreamTimeout = fakeTimeout;
                // @ts-ignore
                bouncer.runningStreams = [mockDecisionStream];

                // @ts-ignore
                expect(bouncer.runningStreams.length).toBe(1);

                expect(listeners.close());

                expect(mockTimeoutCleared).toHaveBeenCalled();

                // stream removed from runningStreams
                // @ts-ignore
                expect(bouncer.runningStreams.length).toBe(0);
            });

            it('should handle the pause listener', async () => {
                // @ts-ignore
                bouncer.getStreamTimeout = fakeTimeout;
                // @ts-ignore
                bouncer.runningStreams = [mockDecisionStream];

                // @ts-ignore
                expect(bouncer.runningStreams.length).toBe(1);

                expect(listeners.pause());

                expect(mockTimeoutCleared).toHaveBeenCalled();

                // stream not removed from runningStreams
                // @ts-ignore
                expect(bouncer.runningStreams.length).toBe(1);
            });

            it('should handle the error listener', async () => {
                const fakeError = new Error('tutu');
                expect(listeners.error(fakeError));

                expect(mockDebug).toHaveBeenCalledWith('stream emit error : %o', fakeError);
            });
        });
    });
    describe('getRawStream', () => {
        it('should getRawStream with full options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.getRawStream({
                    startup: false,
                    scopes: '1,2,3,4,5',
                    origins: '1,2,3,4,5',
                    scenarios_containing: '1,2,3,4,5',
                    scenarios_not_containing: '1,2,3,4,5'
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions/stream', {
                params: {
                    origins: '1,2,3,4,5',
                    scenarios_containing: '1,2,3,4,5',
                    scenarios_not_containing: '1,2,3,4,5',
                    scopes: '1,2,3,4,5',
                    startup: false
                }
            });
        });
        it('should getRawStream without options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(await bouncer.getRawStream()).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions/stream', {
                params: {}
            });
        });
        it('should getRawStream with other options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.getRawStream({
                    startup: false,
                    scopes: '1,2,3,4,5',
                    origins: '1,2,3,4,5',
                    scenarios_containing: '1,2,3,4,5',
                    scenarios_not_containing: '1,2,3,4,5'
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions/stream', {
                params: {
                    origins: '1,2,3,4,5',
                    scenarios_containing: '1,2,3,4,5',
                    scenarios_not_containing: '1,2,3,4,5',
                    scopes: '1,2,3,4,5',
                    startup: false
                }
            });
        });
        it('should getRawStream with arrays', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.getRawStream({
                    startup: true,
                    scopes: ['1', '2', '3'],
                    origins: ['1', '2', '3'],
                    scenarios_containing: ['1', '2', '3'],
                    scenarios_not_containing: ['1', '2', '3']
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions/stream', {
                params: {
                    origins: '1,2,3',
                    scenarios_containing: '1,2,3',
                    scenarios_not_containing: '1,2,3',
                    scopes: '1,2,3',
                    startup: true
                }
            });
        });
        it('should return nothing', async () => {
            httpGetMock.mockImplementationOnce(() => ({}));

            expect(
                await bouncer.getRawStream({
                    startup: true,
                    scopes: ['1', '2', '3'],
                    origins: ['1', '2', '3'],
                    scenarios_containing: ['1', '2', '3'],
                    scenarios_not_containing: ['1', '2', '3']
                })
            ).toStrictEqual(undefined);

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions/stream', {
                params: {
                    origins: '1,2,3',
                    scenarios_containing: '1,2,3',
                    scenarios_not_containing: '1,2,3',
                    scopes: '1,2,3',
                    startup: true
                }
            });
        });
    });
    describe('stop', () => {
        it('should call stop of the stream stored', async () => {
            const closeMock = jest.fn();
            // @ts-ignore
            bouncer.runningStreams = [{ close: closeMock }];

            bouncer.stop();

            expect(closeMock).toHaveBeenCalled();
        });
    });
});
