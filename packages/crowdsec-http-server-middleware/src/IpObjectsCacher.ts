import { LRUCache } from 'lru-cache';
import { AddressObject, getIpObject } from './utils.js';
import { MAX_IP_CACHE } from './globals.js';

export class IpObjectsCacher {
    private ipObjectCache: LRUCache<string, AddressObject, unknown>;
    constructor(max: number = MAX_IP_CACHE) {
        this.ipObjectCache = new LRUCache<string, AddressObject>({
            max
        });
    }

    public getIpObjectWithCache(value: string): AddressObject {
        const cachedIp = this.ipObjectCache.get(value);
        if (cachedIp) {
            return cachedIp;
        }

        const ip = getIpObject(value);

        this.ipObjectCache.set(value, ip);
        return ip;
    }
}
