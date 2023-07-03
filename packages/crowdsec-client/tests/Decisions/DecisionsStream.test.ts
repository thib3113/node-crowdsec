import { afterEach, beforeEach, describe, expect, jest, it } from '@jest/globals';
import type { DecisionsStream } from '../../src/Decisions/DecisionsStream.js';
import type { Decision } from '../../src/Decisions/Decision.js';

const mockDebug = jest.fn();
const mockDebugExtend = jest.fn().mockImplementation(() => mockDebug);
const createDebuggerMock = jest.fn().mockImplementation(() => mockDebug);
// @ts-ignore
mockDebug.extend = mockDebugExtend;

jest.unstable_mockModule('../../src/utils.js', () => ({
    createDebugger: createDebuggerMock,
    setImmediatePromise: async () => {
        return new Promise<void>((resolve) => {
            setImmediate(() => resolve());
        });
    }
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

        it('should push new decision', async () => {
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

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            stream.push({
                new: [decision]
            });

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(1);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            expect(mockLoopWrapper).toHaveBeenCalled();
            expect(mockDecisionObject).toHaveBeenCalledWith(decision);
        });
        it('should push new decisions', async () => {
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

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            stream.push({
                new: [decision, decision]
            });

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(2);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            expect(mockLoopWrapper).toHaveBeenCalled();
            expect(mockDecisionObject).toHaveBeenCalledTimes(2);
        });
        it('should push deleted decision', async () => {
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

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            stream.push({
                deleted: [decision]
            });

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(1);

            expect(mockLoopWrapper).toHaveBeenCalled();
            expect(mockDecisionObject).toHaveBeenCalledWith(decision);
        });
        it('should push deleted decisions', async () => {
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

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(0);

            stream.push({
                deleted: [decision, decision]
            });

            // @ts-ignore
            expect(stream.decisions.added.length).toBe(0);
            // @ts-ignore
            expect(stream.decisions.deleted.length).toBe(2);

            expect(mockLoopWrapper).toHaveBeenCalled();
            expect(mockDecisionObject).toHaveBeenCalledTimes(2);
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
            await new Promise((resolve) => {
                mockDebug.mockImplementationOnce(resolve);
                mockLoop.mockImplementationOnce(() => Promise.reject(fakeError));
                loopWrapper();
            });

            expect(mockDebug).toHaveBeenCalledWith('uncatched promise from loop : %o', fakeError);
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

            expect(mockEmit).toHaveBeenCalledWith('added', fakeDecision);
            expect(decisionsArray.length).toBe(0);
        });

        it('should emit decision with the type deleted', async () => {
            // @ts-ignore
            stream._paused = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [fakeDecision];
            await emitDecisions('deleted', decisionsArray);

            expect(mockEmit).toHaveBeenCalledWith('deleted', fakeDecision);
            expect(decisionsArray.length).toBe(0);
        });

        it("shouldn't emit decision", async () => {
            // @ts-ignore
            stream._paused = false;

            await emitDecisions('deleted', []);

            expect(mockEmit).not.toHaveBeenCalled();
        });

        it('should emit X decision', async () => {
            // @ts-ignore
            stream._paused = false;

            const times = 10;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [...new Array(times)].map(() => fakeDecision);
            const res = await emitDecisions('added', decisionsArray);

            expect(mockEmit).toHaveBeenCalledTimes(times);
        });

        it('should pause if paused change in the loop', async () => {
            // @ts-ignore
            stream._paused = false;

            const fakeDecision = { type: 'decision' } as unknown as Decision;
            const decisionsArray = [...new Array(1e6)].map(() => fakeDecision);
            const res = emitDecisions('added', decisionsArray);

            // @ts-ignore
            stream._paused = true;

            await res;
            expect(decisionsArray.length).toBeGreaterThan(0);
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

            expect(mockEmit).toHaveBeenCalledWith('error', fakeError);

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
