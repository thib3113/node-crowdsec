import { AddressObject } from './utils.js';
import { Address4 } from 'ip-address';

type numericAddress = number | bigint;

/**
 * An in-memory index of decisions indexed by CIDR.
 *
 * IPs are matched as numbers : a CIDR "1.2.3.0/24" is a prefix of bits, so an
 * ip is in the subnet iff `ip >> (bitWidth - mask)` equals the network part.
 *
 * To look up an ip we walk up from the most specific mask to the least
 * specific one, and stop at the first match (a /32 hit costs a single Map
 * lookup). This is well suited to bouncer workloads where the vast majority
 * of flagged ips are single /32, and large ranges (a /8 of a country, a /16
 * of an ASN...) are rare but still handled.
 *
 * Ranges are indexed per mask length : `masks.get(mask)` is a Map whose keys
 * are the shifted network part. The numeric representation of an address is
 * computed once and cached (WeakMap), which pairs well with the
 * IpObjectsCacher that already returns the same AddressObject instance for a
 * given ip string.
 */
export class IpDecisionDB<T> {
    private masks = new Map<number, Map<numericAddress, Array<T>>>();
    private activeMasks: Array<number> = [];
    private numericCache = new WeakMap<AddressObject, numericAddress>();

    /**
     * index a decision under a CIDR
     * @param ip - an address or network object (subnetMask is the prefix length)
     * @param decision - the value to store
     */
    public insert(ip: AddressObject, decision: T): void {
        const mask = ip.subnetMask;
        const key = this.keyFor(ip, mask);

        let bucket = this.masks.get(mask);
        if (!bucket) {
            bucket = new Map<numericAddress, Array<T>>();
            this.masks.set(mask, bucket);
        }
        let decisions = bucket.get(key);
        if (!decisions) {
            decisions = [];
            bucket.set(key, decisions);
        }
        decisions.push(decision);

        if (!this.activeMasks.includes(mask)) {
            this.activeMasks.push(mask);
            // most specific ( /32 ) first, so lookups stop as soon as possible
            this.activeMasks.sort((a, b) => b - a);
        }
    }

    /**
     * find the most specific decision matching an ip
     * @param ip - the address to check
     */
    public lookup(ip: AddressObject): T | undefined {
        for (const mask of this.activeMasks) {
            const decisions = this.masks.get(mask)?.get(this.keyFor(ip, mask));
            if (decisions && decisions.length > 0) {
                return decisions[0];
            }
        }
        return undefined;
    }

    /**
     * remove decisions matching the given predicate from the index
     * @returns true if something was removed
     */
    public delete(ip: AddressObject, predicate: (decision: T) => boolean): boolean {
        const mask = ip.subnetMask;
        const bucket = this.masks.get(mask);
        if (!bucket) {
            return false;
        }

        const key = this.keyFor(ip, mask);
        const decisions = bucket.get(key);
        if (!decisions) {
            return false;
        }

        const before = decisions.length;
        const filtered = decisions.filter((decision) => !predicate(decision));
        const removed = before !== filtered.length;
        if (!removed) {
            return false;
        }

        if (filtered.length === 0) {
            bucket.delete(key);
            if (bucket.size === 0) {
                this.masks.delete(mask);
                this.activeMasks = this.activeMasks.filter((m) => m !== mask);
            }
        } else {
            bucket.set(key, filtered);
        }
        return true;
    }

    /**
     * remove every decision matching the given predicate from the index
     * @returns the removed decisions
     */
    public removeIf(predicate: (decision: T) => boolean): Array<T> {
        const removed: Array<T> = [];
        for (const [mask, bucket] of this.masks) {
            for (const [key, decisions] of bucket) {
                const before = decisions.length;
                const filtered = decisions.filter((decision) => {
                    if (predicate(decision)) {
                        removed.push(decision);
                        return false;
                    }
                    return true;
                });
                if (filtered.length === before) {
                    continue;
                }
                if (filtered.length === 0) {
                    bucket.delete(key);
                } else {
                    bucket.set(key, filtered);
                }
            }
            if (bucket.size === 0) {
                this.masks.delete(mask);
                this.activeMasks = this.activeMasks.filter((m) => m !== mask);
            }
        }
        return removed;
    }

    /**
     * numeric representation of an ip, computed once per address instance
     */
    private numericOf(ip: AddressObject): numericAddress {
        let value = this.numericCache.get(ip);
        if (value === undefined) {
            if (ip instanceof Address4) {
                value = Number(ip.bigInt());
            } else {
                value = ip.bigInt();
            }
            this.numericCache.set(ip, value);
        }
        return value;
    }

    private keyFor(ip: AddressObject, mask: number): numericAddress {
        const numeric = this.numericOf(ip);
        if (typeof numeric === 'number') {
            // >>> handles values up to 2^32-1 and always returns an unsigned int
            return numeric >>> (32 - mask);
        }
        return numeric >> BigInt(128 - mask);
    }
}
