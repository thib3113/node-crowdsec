import { BaseSubObject } from '../src/BaseSubObject.js';
import { describe, expect } from '@jest/globals';
import { AxiosInstance } from 'axios';

class Test extends BaseSubObject {}

describe('BaseSubObjectTest.test.ts', () => {
    it('should setup httpClient on constructor', async () => {
        const fakeHttpClient = { foo: 'bar' } as unknown as AxiosInstance;

        const test = new Test({
            httpClient: fakeHttpClient
        });

        // @ts-ignore
        expect(test.http).toBe(fakeHttpClient);
    });
});
