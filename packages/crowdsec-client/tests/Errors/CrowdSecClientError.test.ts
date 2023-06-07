import { CrowdsecClientError } from '../../src/Errors/CrowdsecClientError.js';
import { EErrorsCodes } from '../../src/Errors/EErrorsCodes.js';

describe('CrowdsecClientError.test.ts', () => {
    it('should create CrowdsecClientError', () => {
        const err = new CrowdsecClientError('message', EErrorsCodes.UNAUTHORIZED);
        expect(err.message).toBe(`message`);
    });
    it('should create empty CrowdsecClientError', () => {
        new CrowdsecClientError();
    });
});
