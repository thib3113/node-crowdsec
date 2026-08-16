import { describe, expect, it } from 'vitest';
import { IpDecisionDB } from '../../src/IpDecisionDB.js';
import { getIpObject, AddressObject } from '../../src/utils.js';

const ipObjectCache: Map<string, AddressObject> = new Map();
const getCachedIpObject = (ip: string) => {
    let cached = ipObjectCache.get(ip);
    if (!cached) {
        cached = getIpObject(ip);
        ipObjectCache.set(ip, cached);
    }
    return cached;
};

const buildIndex = () => {
    const db = new IpDecisionDB<string>();
    // 50k decisions : 95% exact /32, 5% /24 ranges (realistic bouncer)
    for (let i = 0; i < 50000; i++) {
        const a = i % 256;
        const b = Math.floor(i / 256) % 256;
        if (i % 20 === 0) {
            db.insert(getCachedIpObject(`10.${b}.${a}.0/24`), `range-${i}`);
        } else {
            db.insert(getCachedIpObject(`10.${b}.${a}.128`), `ip-${i}`);
        }
    }
    return db;
};

describe('IpDecisionDB perf', () => {
    it('should check 50k ips against 50k decisions quickly', () => {
        const db = buildIndex();

        const targets: Array<AddressObject> = [];
        for (let i = 0; i < 50000; i++) {
            const a = i % 256;
            const b = Math.floor(i / 256) % 256;
            targets.push(getCachedIpObject(`10.${b}.${a}.128`));
        }

        const lookupStart = Date.now();
        let matched = 0;
        for (const t of targets) {
            if (db.lookup(t)) {
                matched++;
            }
        }
        const lookupTime = Date.now() - lookupStart;

        expect(matched).toBe(47500 + 2500);
        // 50k lookups must stay well under a second
        expect(lookupTime).toBeLessThan(1000);
        // eslint-disable-next-line no-console
        console.log(`lookup 50k ips: ${lookupTime}ms`);
    });

    it('should keep the event loop responsive while processing lookups', async () => {
        const db = buildIndex();

        // measure how long the event loop is blocked between two yields while
        // a realistic batch of lookups is processed in chunks
        const targets: Array<AddressObject> = [];
        for (let i = 0; i < 50000; i++) {
            const a = i % 256;
            const b = Math.floor(i / 256) % 256;
            targets.push(getCachedIpObject(`10.${b}.${a}.128`));
        }

        let maxBlock = 0;
        let lastTick = Date.now();
        const monitor = setInterval(() => {
            const tick = Date.now();
            maxBlock = Math.max(maxBlock, tick - lastTick);
            lastTick = tick;
        }, 1);

        const CHUNK = 1000;
        for (let i = 0; i < targets.length; i += CHUNK) {
            for (let j = i; j < Math.min(i + CHUNK, targets.length); j++) {
                db.lookup(targets[j]);
            }
            await new Promise((resolve) => setImmediate(resolve));
        }

        clearInterval(monitor);

        // chunks are small enough that the loop is never blocked for long
        expect(maxBlock).toBeLessThan(50);
        // eslint-disable-next-line no-console
        console.log(`max event loop block between chunks: ${maxBlock}ms`);
    });
});
