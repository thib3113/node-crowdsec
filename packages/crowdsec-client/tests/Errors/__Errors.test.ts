import { __Error, EErrorsCodes } from '../../src/Errors/index.js';
import { expect, jest } from '@jest/globals';
import { util } from 'prettier';
import isNextLineEmpty = util.isNextLineEmpty;

describe('Errors', () => {
    describe('__Error', () => {
        let OriginalError: ErrorConstructor;

        beforeAll(() => {
            OriginalError = global.Error;
        });

        afterAll(() => {
            global.Error = OriginalError;
        });

        it('should handle error', () => {
            const err = new __Error(new Error('my error'), EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.code).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.errorCode).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.message).toBe('my error');
            expect(err.toString()).toMatch(/=== CAUSED BY ===/);
        });
        it('should handle message', () => {
            const err = new __Error('my error', EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.code).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.errorCode).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.message).toBe('my error');
        });
        it('should handle caused by', () => {
            const err = new __Error('my error', EErrorsCodes.CONNECTION_TEST_FAILED, 'caused by me');
            expect(err.code).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.errorCode).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.message).toBe('my error');
            expect(err.toString()).toMatch(/=== CAUSED BY ===/);
        });
        it('should handle empty init', () => {
            const err = new __Error();
            expect(err.code).toBe(EErrorsCodes.UNKNOWN_ERROR);
            expect(err.errorCode).toBe(EErrorsCodes.UNKNOWN_ERROR);
            expect(err.message).toBe('');
        });
        it('should handle error without stack', async () => {
            // @ts-ignore
            global.Error = jest.fn(() => ({ stack: null }));

            const err = new __Error('my error', EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.code).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.errorCode).toBe(EErrorsCodes.CONNECTION_TEST_FAILED);
            expect(err.message).toBe('my error');
        });
        it('should handle error without some properties', async () => {
            const err = new __Error('my error', EErrorsCodes.CONNECTION_TEST_FAILED);
            // @ts-ignore
            err.name = undefined;
            // @ts-ignore
            err._message = undefined;
            // @ts-ignore
            err.errorCode = undefined;
            expect(err.toString()).toBe(`Error :  \n Error : my error\n`);
        });
    });
});
