import createDebug, { Debugger } from 'debug';
import { pkg } from './pkg.js';
import { Address4, Address6 } from 'ip-address';
import { APITypes } from 'crowdsec-client';

const debug = createDebug(pkg.name);

/**
 * create a debugger extending the default debugger
 * @param name - name for the debugger
 */
export const createDebugger = (name: string): Debugger => {
    if (!name) {
        throw new Error('name is mandatory');
    }
    return debug.extend(name);
};

export type AddressObject = Address4 | Address6;

export const getIpObject = (ip: string): AddressObject => {
    try {
        //check if it's a valid IPv4
        return new Address4(ip);
    } catch (e) {
        //e is not instance of AddressError
        if ((e as { name: string }).name === 'AddressError') {
            //maybe it's a valid IPv6
            return new Address6(ip);
        } else {
            throw e;
        }
    }
};

export const mergeMetas = (originalMetas: APITypes.Meta = [], meta: Record<string, string | undefined> = {}): APITypes.Meta => {
    return Object.entries(meta || {}).reduce((values, [key, value]) => {
        if (!value || values.find((value) => key === value.key)) {
            return values;
        }

        values.push({ key, value });
        return values;
    }, originalMetas);
};
