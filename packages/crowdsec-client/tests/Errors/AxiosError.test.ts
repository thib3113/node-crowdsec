import { AxiosError } from '../../src/Errors/AxiosError.js';
import type { AxiosError as BaseAxiosError } from 'axios';
import * as util from 'util';
import { expect } from '@jest/globals';

const error: BaseAxiosError = {
    message: 'testErrorMessage',
    config: {
        data: 'data',
        method: 'get',
        url: '/'
    },
    request: {},
    response: {
        data: 'response.data',
        status: 500,
        statusText: 'statusTextError'
    },
    status: 500
} as unknown as BaseAxiosError;

describe('AxiosError.test.ts', () => {
    it('should create AxiosError', () => {
        const err = new AxiosError(error);
        expect(typeof err.stack).toBe('string');
        err.stack = 'stack';
        expect(err[util.inspect.custom]()).toBe(`
stack

Error Message -
  testErrorMessage

Request -
  GET /

Request Data -
  "data"

Response -
  500 statusTextError

Response Data -
  "response.data"
`);
    });
    it('should create AxiosError without request', () => {
        // @ts-ignore
        const err = new AxiosError({ ...error, config: { ...error.config, method: '' } });
        expect(typeof err.stack).toBe('string');
        err.stack = 'stack';
        expect(err[util.inspect.custom]()).toBe(`
stack

Error Message -
  testErrorMessage

Request -
   /

Request Data -
  "data"

Response -
  500 statusTextError

Response Data -
  "response.data"
`);
    });
    it('should create AxiosError with un stringifiable data', () => {
        const a = {};
        const b = { a };
        // @ts-ignore
        a.b = b;

        // @ts-ignore
        const err = new AxiosError({
            ...error,
            // @ts-ignore
            response: {
                ...error.response,
                data: b
            }
        });
        expect(typeof err.stack).toBe('string');
        err.stack = 'stack';
        expect(err[util.inspect.custom]()).toBe(`
stack

Error Message -
  testErrorMessage

Request -
  GET /

Request Data -
  "data"

Response -
  500 statusTextError

Response Data -
  <json-unstringifiable>
`);
    });
    it('should create AxiosError with empty data string', () => {
        // @ts-ignore
        const err = new AxiosError({
            ...error,
            // @ts-ignore
            response: {
                ...error.response,
                data: () => {}
            }
        });
        expect(typeof err.stack).toBe('string');
        err.stack = 'stack';
        expect(err[util.inspect.custom]()).toBe(`
stack

Error Message -
  testErrorMessage

Request -
  GET /

Request Data -
  "data"

Response -
  500 statusTextError

Response Data -

`);
    });
    it('should create AxiosError with string', () => {
        const err = new AxiosError('message', error);
        expect(typeof err.stack).toBe('string');
        err.stack = 'stack';
        expect(err[util.inspect.custom]()).toBe(`
stack

Error Message -
  message

Request -
  GET /

Request Data -
  "data"

Response -
  500 statusTextError

Response Data -
  "response.data"
`);
    });
});
