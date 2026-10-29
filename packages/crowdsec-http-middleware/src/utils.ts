import createDebug, { Debugger } from 'debug';
import { pkg } from './pkg.js';
import { Address4, Address6 } from 'ip-address';

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

/**
 * Upper bound on the length of an IP string accepted for parsing.
 *
 * A valid IP is at most 45 chars (`1111:2222:3333:4444:5555:6666:255.255.255.255`),
 * 49 with a CIDR suffix (`.../128`). This bound is deliberately large (20x margin)
 * to stay future-proof (zone ids, ...) : its only purpose is to reject oversized
 * attacker-controlled input before it reaches `ip-address` parsing
 * (CVE-2026-101911 : unbounded Address6 diagnostic -> sync stall / OOM on MiB-scale strings).
 */
export const MAX_IP_LENGTH = 1024;

export const getIpObject = (ip: string): AddressObject => {
    if (ip.length > MAX_IP_LENGTH) {
        const error = new Error(`ip string too long (${ip.length} > ${MAX_IP_LENGTH})`);
        error.name = 'AddressError';
        throw error;
    }
    try {
        //check if it's a valid IPv4
        return new Address4(ip);
    } catch (e) {
        //e is not instance of AddressError
        if ((e as { name: string }).name !== 'AddressError') {
            throw e;
        }

        //maybe it's a valid IPv6
        const address = new Address6(ip);
        //IPv4-mapped IPv6 are compared as IPv4 ( https://github.com/thib3113/node-crowdsec/issues/88 )
        if (address.is4() && address.address4) {
            return address.address4;
        }

        return address;
    }
};
