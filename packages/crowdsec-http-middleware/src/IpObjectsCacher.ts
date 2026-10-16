import { LRUCache } from 'lru-cache';
import { AddressObject, MAX_IP_LENGTH, getIpObject } from './utils.js';
import { MAX_IP_CACHE } from './globals.js';

export class IpObjectsCacher {
    private ipObjectCache: LRUCache<string, AddressObject, unknown>;
    constructor(max: number = MAX_IP_CACHE) {
        this.ipObjectCache = new LRUCache<string, AddressObject>({
            max
        });
    }

    public getIpObjectWithCache(value: string): AddressObject {
        if (value.length > MAX_IP_LENGTH) {
            const error = new Error(`ip string too long (${value.length} > ${MAX_IP_LENGTH})`);
            error.name = 'AddressError';
            throw error;
        }
        const cachedIp = this.ipObjectCache.get(value);
        if (cachedIp) {
            return cachedIp;
        }

        const ip = getIpObject(value);

        this.ipObjectCache.set(value, ip);
        return ip;
    }
}
