/**
 * Internal type-guard helpers used by the middleware.
 *
 * This class is not part of the public API. Keep it in sync with the copy in
 * `packages/crowdsec-client/src/Validate.ts`.
 *
 * @internal
 */
export class Validate {
    // Returns if a value is a string
    public static isString(value: unknown): value is string {
        return typeof value === 'string' || value instanceof String;
    }

    // Returns if a value is really a number
    public static isNumber(value: unknown): value is number {
        return typeof value === 'number' && isFinite(value);
    }

    // Returns if a value is a boolean
    public static isBoolean(value: unknown): value is boolean {
        return typeof value === 'boolean';
    }

    public static implementsTKeys<T>(obj: any, keys: Array<keyof T>): obj is T {
        if (!obj || !Array.isArray(keys) || Validate.isString(obj) || Validate.isNumber(obj) || Validate.isBoolean(obj)) {
            return false;
        }

        return keys.reduce((impl, key) => impl && key in obj, true);
    }
}

export default Validate;
