import { afterEach, beforeEach, describe, expect, jest, it } from '@jest/globals';
import type { DecisionsStream } from '../../src/Decisions/DecisionsStream.js';
import type { Decision } from '../../src/Decisions/Decision.js';
import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';
import type { nonBlockingFn } from '../../src/utils.js';

const mockDebug = jest.fn();
const mockDebugExtend = jest.fn().mockImplementation(() => mockDebug);
const createDebuggerMock = jest.fn().mockImplementation(() => mockDebug);
// @ts-ignore
mockDebug.extend = mockDebugExtend;

const mockNonBlockingLoop = jest.fn<any>();

jest.unstable_mockModule('../../src/utils.js', () => ({
    createDebugger: createDebuggerMock,
    setImmediatePromise: async () => {
        return new Promise<void>((resolve) => {
            setImmediate(() => resolve());
        });
    },
    nonBlockingLoop: mockNonBlockingLoop
}));

const mockDecisionObject = jest.fn();
jest.unstable_mockModule('../../src/Decisions/Decision', () => ({ Decision: mockDecisionObject }));

describe('DecisionsStream', () => {
    let stream: DecisionsStream;
    beforeEach(async () => {
        const res = await import('../../src/Decisions/DecisionsStream.js');
        // @ts-ignore
        stream = new res.DecisionsStream();
    });

    describe('paused', () => {
        it('should return the content of paused', async () => {
            // @ts-ignore
            stream._paused = true;

            expect(stream.paused).toBeTruthy();

            // @ts-ignore
            stream._paused = false;

            expect(stream.paused).toBeFalsy();
        });
    });

    describe('pause', () => {
        const mockEmit = jest.fn();
        beforeEach(() => {
            // @ts-ignore
            stream.emit = mockEmit;
        });
        afterEach(() => {
            mockEmit.mockClear();
        });

        it('should pause the stream', async () => {
            // @ts-ignore
            stream._paused = false;

            expect(stream.paused).toBe(false);
            stream.pause();

            expect(mockEmit).toHaveBeenCalledWith('pause');
            expect(stream.paused).toBe(true);
        });
    });
    describe('resume', () => {
        const mockEmit = jest.fn();
        const mockLoopWrapper = jest.fn();
        beforeEach(() => {
            // @ts-ignore
            stream.emit = mockEmit;
            // @ts-ignore
            stream.loopWrapper = mockLoopWrapper;
        });
        afterEach(() => {
            mockEmit.mockClear();
            mockLoopWrapper.mockClear();
        });

        it('should resume the stream', async () => {
            // @ts-ignore
            stream._paused = true;

            expect(stream.paused).toBe(true);
            stream.resume();

            expect(mockEmit).toHaveBeenCalledWith('resume');
            expect(stream.paused).toBe(false);
            expect(mockLoopWrapper).toHaveBeenCalledWith();
        });
    });
    describe('start', () => {
        const mockResume = jest.fn();
        beforeEach(() => {
            // @ts-ignore
            stream.resume = mockResume;
        });
        afterEach(() => {
            mockResume.mockClear();
        });

        it('should be an allias of resume', async () => {
            stream.start();

            expect(mockResume).toHaveBeenCalledWith();
        });
    });
    describe('close', () => {
        const mockEmit = jest.fn();
        beforeEach(() => {
            // @ts-ignore
            stream.emit = mockEmit;
        });
        afterEach(() => {
            mockEmit.mockClear();
        });

        it('should close the stream', async () => {
            // @ts-ignore
            stream._paused = false;

            expect(stream.paused).toBe(false);
            stream.close();

            expect(mockEmit).toHaveBeenCalledWith('close');
            expect(stream.paused).toBe(true);
        });
    });

    describe('push', () => {
        const mockLoopWrapper = jest.fn();
        beforeEach(() => {
            // @ts-ignore
            stream.loopWrapper = mockLoopWrapper;
        });
        afterEach(() => {
            mockLoopWrapper.mockClear();
        });

        it('should call nonBlockingLoop with new decisions', async () => {
            mockNonBlockingLoop.mockResolvedValueOnce(undefined);
            mockNonBlockingLoop.mockResolvedValueOnce(undefined);
            const decision = {
                id: 1,
                origin: 'Origin',
                type: 'type',
                scope: 'Scope',
                value: 'value',
                duration: '1h54m',
                until: 'until',
                scenario: 'Scenario',
                simulated: true
            };
            const getDecisionsResponse = {
                new: [decision]
            };

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            stream.push(getDecisionsResponse);

            expect(mockNonBlockingLoop).toHaveBeenNthCalledWith(1, getDecisionsResponse.new, expect.any(Function));

            expect(mockLoopWrapper).toHaveBeenCalled();
        });

        it('should handle Error in addedPromise', async () => {
            const mockHandleError = jest.fn();
            // @ts-ignore
            stream.handleError = mockHandleError;

            const fakeError = new Error('tutu');
            mockNonBlockingLoop.mockRejectedValueOnce(fakeError);
            mockNonBlockingLoop.mockResolvedValueOnce(undefined);
            const decision = {
                id: 1,
                origin: 'Origin',
                type: 'type',
                scope: 'Scope',
                value: 'value',
                duration: '1h54m',
                until: 'until',
                scenario: 'Scenario',
                simulated: true
            };
            const getDecisionsResponse = {
                new: [decision]
            };

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            const error = await new Promise((resolve, reject) => {
                mockHandleError.mockImplementationOnce((e) => {
                    resolve(e);
                });

                stream.push(getDecisionsResponse);
            });

            expect(error).toBeInstanceOf(CrowdsecClientError);
            const err = error as CrowdsecClientError;
            expect(err.message).toBe('fail to parse received decisions');
            expect(err.exception).toBe(fakeError);

            expect(mockNonBlockingLoop).toHaveBeenNthCalledWith(1, getDecisionsResponse.new, expect.any(Function));

            expect(mockLoopWrapper).toHaveBeenCalled();
        });
        it('should handle Error in deletedPromise', async () => {
            const mockHandleError = jest.fn();
            // @ts-ignore
            stream.handleError = mockHandleError;

            const fakeError = new Error('tutu');
            mockNonBlockingLoop.mockResolvedValueOnce(undefined);
            mockNonBlockingLoop.mockRejectedValueOnce(fakeError);
            const decision = {
                id: 1,
                origin: 'Origin',
                type: 'type',
                scope: 'Scope',
                value: 'value',
                duration: '1h54m',
                until: 'until',
                scenario: 'Scenario',
                simulated: true
            };
            const getDecisionsResponse = {
                new: [decision]
            };

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            const error = await new Promise((resolve, reject) => {
                mockHandleError.mockImplementationOnce((e) => {
                    resolve(e);
                });

                stream.push(getDecisionsResponse);
            });

            expect(error).toBeInstanceOf(CrowdsecClientError);
            const err = error as CrowdsecClientError;
            expect(err.message).toBe('fail to parse received decisions');
            expect(err.exception).toBe(fakeError);

            expect(mockNonBlockingLoop).toHaveBeenNthCalledWith(1, getDecisionsResponse.new, expect.any(Function));

            expect(mockLoopWrapper).toHaveBeenCalled();
        });
        describe('nonBlocking', () => {
            const mockEmit = jest.fn();
            const decision = {
                id: 1,
                origin: 'Origin',
                type: 'type',
                scope: 'Scope',
                value: 'value',
                duration: '1h54m',
                until: 'until',
                scenario: 'Scenario',
                simulated: true
            };
            const getDecisionsResponse = {
                new: [decision],
                deleted: [decision]
            };
            beforeEach(() => {
                mockNonBlockingLoop.mockResolvedValueOnce(undefined);
                mockNonBlockingLoop.mockResolvedValueOnce(undefined);

                // @ts-ignore
                stream.emit = mockEmit;
            });
            it.each<'added' | 'deleted' | 'both'>(['deleted', 'added', 'both'])(
                'should use the function NonBlocking to avoid blocking event loop, with definition %s',
                (type) => {
                    const responseTypes: { [key: string]: any } = {
                        deleted: { deleted: getDecisionsResponse.deleted },
                        added: { new: getDecisionsResponse.new },
                        both: {
                            new: getDecisionsResponse.new,
                            deleted: getDecisionsResponse.deleted
                        }
                    };

                    stream.push(responseTypes[type]);

                    if (type != 'deleted') {
                        expect(mockNonBlockingLoop).toHaveBeenNthCalledWith(1, getDecisionsResponse.new, expect.any(Function));
                    }

                    if (type != 'added') {
                        expect(mockNonBlockingLoop).toHaveBeenNthCalledWith(2, getDecisionsResponse.deleted, expect.any(Function));
                    }

                    // get the function passed in to the nonBlockingLoop and then test it using a fake Decision function and receivedDecisions object
                    const functionPassedToAdd = mockNonBlockingLoop.mock.calls[0][1] as (d: any) => void;
                    const functionPassedToDelete = mockNonBlockingLoop.mock.calls[1][1] as (d: any) => void;

                    mockDecisionObject.mockReturnValueOnce({ decision: 'added' });
                    mockDecisionObject.mockReturnValueOnce({ decision: 'deleted' });

                    // @ts-ignore
                    stream.decisions = {
                        added: [],
                        deleted: []
                    };

                    // call the function passed in
                    functionPassedToAdd(decision);
                    functionPassedToDelete(decision);

                    expect(mockDecisionObject).toHaveBeenCalledTimes(2);

                    // @ts-ignore
                    expect(stream.decisions.added).toStrictEqual([{ decision: 'added' }]);
                    // @ts-ignore
                    expect(stream.decisions.deleted).toStrictEqual([{ decision: 'deleted' }]);
                }
            );
            it('should test the function passed to NonBlocking', async () => {
                const added = [{ definition: 'added' }];
                const deleted = [{ definition: 'deleted' }];
                mockNonBlockingLoop.mockResolvedValueOnce(added);
                mockNonBlockingLoop.mockResolvedValueOnce(deleted);

                const decision = {
                    id: 1,
                    origin: 'Origin',
                    type: 'type',
                    scope: 'Scope',
                    value: 'value',
                    duration: '1h54m',
                    until: 'until',
                    scenario: 'Scenario',
                    simulated: true
                };
                const getDecisionsResponse = {
                    new: [decision]
                };

                const mockEmit = jest.fn();
                // @ts-ignore
                stream.emit = mockEmit;

                // @ts-ignore
                expect(stream.decisions.added.length).toBe(0);
                // @ts-ignore
                expect(stream.decisions.deleted.length).toBe(0);

                stream.push(getDecisionsResponse);

                expect(mockNonBlockingLoop).toHaveBeenNthCalledWith(1, getDecisionsResponse.new, expect.any(Function));

                // get the function passed in to the nonBlockingLoop and then test it using a fake Decision function and receivedDecisions object
                const functionPassedToAdd = mockNonBlockingLoop.mock.calls[0][1] as (d: any) => void;
                const functionPassedToDelete = mockNonBlockingLoop.mock.calls[1][1] as (d: any) => void;

                mockDecisionObject.mockReturnValueOnce({ decision: 'added' });
                mockDecisionObject.mockReturnValueOnce({ decision: 'deleted' });

                // @ts-ignore
                stream.decisions = {
                    added: [],
                    deleted: []
                };

                // call the function passed in
                functionPassedToAdd(decision);
                functionPassedToDelete(decision);

                expect(mockEmit).toHaveBeenNthCalledWith(1, 'raw', getDecisionsResponse);

                expect(mockDecisionObject).toHaveBeenCalledTimes(2);

                // @ts-ignore
                expect(stream.decisions.added).toStrictEqual([{ decision: 'added' }]);
                // @ts-ignore
                expect(stream.decisions.deleted).toStrictEqual([{ decision: 'deleted' }]);
            });
        });
    });

    describe('loopWrapper', () => {
        const mockLoop = jest.fn().mockImplementation(() => Promise.resolve());
        let loopWrapper: DecisionsStream['loopWrapper'];
        beforeEach(() => {
            // @ts-ignore
            stream.loop = mockLoop;
            // @ts-ignore
            loopWrapper = stream.loopWrapper.bind(stream);
        });
        afterEach(() => {
            mockLoop.mockClear();
        });

        it('should call the loop', async () => {
            loopWrapper();

            expect(mockLoop).toHaveBeenCalledWith();
        });

        it('should handle loop errors', async () => {
            const fakeError = new Error();
            const mockHandleError = jest.fn();
            // @ts-ignore
            stream.handleError = mockHandleError;

            await new Promise((resolve) => {
                mockDebug.mockImplementationOnce(resolve);
                mockLoop.mockImplementationOnce(() => Promise.reject(fakeError));
                loopWrapper();
            });

            expect(mockHandleError).toHaveBeenCalledWith(expect.any(CrowdsecClientError));
            expect(mockLoop).toHaveBeenCalledWith();
        });
    });

    describe('emitDecisions', () => {
        const mockEmit = jest.fn();
        let emitDecisions: DecisionsStream['emitDecisions'];
        beforeEach(() => {
            // @ts-ignore
            stream.emit = mockEmit;

            // @ts-ignore
            emitDecisions = stream.emitDecisions.bind(stream);
        });
        afterEach(() => {
            mockEmit.mockClear();
        });

        it('should emit decision with the type added', async () => {
            // @ts-ignore
            stream._paused = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [fakeDecision];
            await emitDecisions('added', decisionsArray);

            expect(mockNonBlockingLoop).toHaveBeenCalledWith(decisionsArray, expect.any(Function));
            const fakeStopFn = jest.fn();
            const functionPassedToAdd = mockNonBlockingLoop.mock.calls[0][1] as nonBlockingFn<any>;

            //should return undefined to remove from array
            expect(await functionPassedToAdd(fakeDecision, fakeStopFn)).toBeUndefined();

            expect(mockEmit).toHaveBeenCalledWith('added', fakeDecision);
        });

        it('should emit decision with the type deleted', async () => {
            // @ts-ignore
            stream._paused = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [fakeDecision];
            await emitDecisions('deleted', decisionsArray);

            expect(mockNonBlockingLoop).toHaveBeenCalledWith(decisionsArray, expect.any(Function));

            const fakeStopFn = jest.fn();
            const functionPassedToAdd = mockNonBlockingLoop.mock.calls[0][1] as nonBlockingFn<any>;

            //should return undefined to remove from array
            expect(await functionPassedToAdd(fakeDecision, fakeStopFn)).toBeUndefined();

            expect(mockEmit).toHaveBeenCalledWith('deleted', fakeDecision);
        });

        it("shouldn't emit decision", async () => {
            // @ts-ignore
            stream._paused = false;

            await emitDecisions('deleted', []);

            expect(mockNonBlockingLoop).toHaveBeenCalledWith([], expect.any(Function));

            expect(mockEmit).not.toHaveBeenCalled();
        });

        it('should emit X decision', async () => {
            // @ts-ignore
            stream._paused = false;

            const times = 10;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [...new Array(times)].map(() => fakeDecision);
            const res = await emitDecisions('added', decisionsArray);

            expect(mockNonBlockingLoop).toHaveBeenCalledWith(decisionsArray, expect.any(Function));
        });

        it('should pause if paused change in the loop', async () => {
            // @ts-ignore
            stream._paused = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [...new Array(1e6)].map(() => fakeDecision);
            await emitDecisions('added', decisionsArray);

            const fakeStopFn = jest.fn();
            const functionPassedToAdd = mockNonBlockingLoop.mock.calls[0][1] as nonBlockingFn<any>;
            expect(await functionPassedToAdd(fakeDecision, fakeStopFn)).toBe(undefined);
            expect(fakeStopFn).not.toHaveBeenCalled();

            // @ts-ignore
            stream._paused = true;

            expect(await functionPassedToAdd(fakeDecision, fakeStopFn)).toBe(fakeDecision);
            expect(fakeStopFn).toHaveBeenCalled();
        });

        it('should clear the emitted decisions', async () => {
            // @ts-ignore
            stream._paused = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const originalLength = 10;
            const decisionsArray = [...new Array(originalLength)].map(() => fakeDecision);

            mockNonBlockingLoop.mockImplementationOnce(() => {
                //replace one item on two by undefined ... like if the decision was emitted
                decisionsArray.forEach((item, index) => {
                    if (index % 2 !== 0) {
                        decisionsArray.splice(index, 1, undefined as unknown as Decision);
                    }
                });
            });

            await emitDecisions('deleted', decisionsArray);

            expect(decisionsArray.length).toBe(Math.floor(originalLength / 2));
            expect(decisionsArray).not.toContain(undefined);

            expect(mockNonBlockingLoop).toHaveBeenCalledWith(decisionsArray, expect.any(Function));
        });
    });
    describe('loop', () => {
        const mockEmit = jest.fn();
        const mockEmitDecisions = jest.fn().mockImplementation(() => Promise.resolve());
        let loop: DecisionsStream['loop'];

        beforeEach(() => {
            // @ts-ignore
            stream.emit = mockEmit;

            // @ts-ignore
            stream.emitDecisions = mockEmitDecisions;

            // @ts-ignore
            loop = stream.loop.bind(stream);
        });
        afterEach(() => {
            mockEmit.mockClear();
            mockEmitDecisions.mockClear();
        });

        it('should emit added decisions', async () => {
            // @ts-ignore
            stream._paused = false;
            // @ts-ignore
            stream.looping = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [fakeDecision];

            // @ts-ignore
            stream.decisions.added = decisionsArray;

            await loop();

            expect(mockEmitDecisions).toHaveBeenCalledWith('added', decisionsArray);
            // @ts-ignore
            expect(stream.looping).toBe(false);
        });
        it('should emit deleted decisions', async () => {
            // @ts-ignore
            stream._paused = false;
            // @ts-ignore
            stream.looping = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [fakeDecision];

            // @ts-ignore
            stream.decisions.deleted = decisionsArray;

            await loop();

            expect(mockEmitDecisions).toHaveBeenCalledWith('deleted', decisionsArray);
            // @ts-ignore
            expect(stream.looping).toBe(false);
        });
        it('should emit error if emitting decisions failed', async () => {
            // @ts-ignore
            stream._paused = false;
            // @ts-ignore
            stream.looping = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [fakeDecision];

            // @ts-ignore
            stream.decisions.deleted = decisionsArray;

            const fakeError = new Error('fakeError');
            mockEmitDecisions.mockImplementationOnce(() => Promise.reject(fakeError));

            await loop();

            expect(mockEmit).toHaveBeenCalledWith(
                'error',
                expect.objectContaining({
                    message: 'loop error',
                    __proto__: CrowdsecClientError.prototype
                })
            );

            expect(mockEmitDecisions).toHaveBeenCalledWith('deleted', decisionsArray);
            // @ts-ignore
            expect(stream.looping).toBe(false);
        });

        it("shouldn't emit decisions if paused", async () => {
            // @ts-ignore
            stream._paused = true;
            // @ts-ignore
            stream.looping = false;

            await loop();

            expect(mockEmitDecisions).not.toHaveBeenCalled();
            // @ts-ignore
            expect(stream.looping).toBe(false);
        });

        it("shouldn't emit decisions if already looping", async () => {
            // @ts-ignore
            stream._paused = false;
            // @ts-ignore
            stream.looping = true;

            await loop();

            expect(mockEmitDecisions).not.toHaveBeenCalled();
        });
    });
});
