import { Validate } from '../src/Validate.js';

describe('Validate.test.ts', () => {
    it('should check that an object implements the requested keys', () => {
        expect(Validate.implementsTKeys<{ foo: string }>({ foo: 'bar' }, ['foo'])).toBeTruthy();
        expect(Validate.implementsTKeys<{ foo: string }>({ bar: 'bar' }, ['foo'])).toBeFalsy();
        expect(Validate.implementsTKeys<{ foo: string }>({}, ['foo'])).toBeFalsy();
    });

    it('should reject primitive values', () => {
        expect(Validate.implementsTKeys<{ length: number }>('abc', ['length'])).toBeFalsy();
        expect(Validate.implementsTKeys<{ length: number }>(123, ['length'])).toBeFalsy();
        expect(Validate.implementsTKeys<{ valueOf: () => boolean }>(true, ['valueOf'])).toBeFalsy();
        expect(Validate.implementsTKeys<{ foo: string }>(null, ['foo'])).toBeFalsy();
        expect(Validate.implementsTKeys<{ foo: string }>(undefined, ['foo'])).toBeFalsy();
    });

    it('should reject a non-array key list', () => {
        expect(Validate.implementsTKeys<{ foo: string }>({ foo: 'bar' }, 'foo' as unknown as Array<'foo'>)).toBeFalsy();
    });
});
