import { CrowdSecServerError } from '../../src/Errors/CrowdSecServerError.js';
import { expect } from '@jest/globals';

describe('CrowdSecServerError.test.ts', () => {
    it('should create CrowdSecServerError', () => {
        const fakeError = new Error();
        // @ts-ignore
        const err = new CrowdSecServerError('message', 500, 'errors', fakeError);
        expect(err.message).toBe(`message (errors)`);
        expect(err.code).toBe(500);
        expect(err.code).toBe(500);
        expect(err.exception).toBe(fakeError);
    });
    it('should create CrowdSecServerError without detailed errors', () => {
        const fakeError = new Error();
        // @ts-ignore
        const err = new CrowdSecServerError('message', 500, undefined, fakeError);
        expect(err.message).toBe(`message`);
        expect(err.code).toBe(500);
        expect(err.code).toBe(500);
        expect(err.exception).toBe(fakeError);
    });
    it('should create empty CrowdSecServerError', () => {
        new CrowdSecServerError();
    });
});
