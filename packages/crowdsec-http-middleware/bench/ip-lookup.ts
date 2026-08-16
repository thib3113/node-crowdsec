/**
 * Micro-benchmarks for IP lookup strategies used by the bouncer.
 *
 * Compares the structures explored during design, across several scenarios :
 *  - hit  : looking up an IP that IS banned (most specific /32 match)
 *  - miss : looking up a legitimate IP (no decision matches, walks all masks)
 *  - by subnetLevel : only masks >= minMask are active (resident / company / country)
 *  - setup : inserting + indexing the decision set (one-time cost)
 *
 * Structures :
 *  - LinearScan : previous implementation, `isInSubnet` over every decision (baseline)
 *  - MapOfMaps  : current IpDecisionDB, Map<mask, Map<network, Array<...>>>
 *  - MapSMI     : same but values packed in a single SMI (no Array/object)
 *  - SortedU32  : Uint32Array per mask, sorted, binary search, SoA values
 *  - OpenHash   : custom open-addressing hash table, SoA
 *
 * NOTE : for simplicity every structure re-parses the ip string on each lookup
 * (`new Address4(...)`). The real `IpDecisionDB` receives a cached AddressObject
 * and reuses a WeakMap of numeric values, so its numbers are even better than
 * what `MapOfMaps` shows here. The relative ordering is unaffected.
 *
 * Run with : `npm run bench`
 */
import Benchmark from 'benchmark';
import { Address4 } from 'ip-address';

const ip4 = (ip: string) => new Address4(ip);
const toU32 = (ip: string): number => Number(ip4(ip).bigInt()) >>> 0;

type Decision = { type: number; until: number };

// ---------------------------------------------------------------------------
// 1. Baseline : linear scan with isInSubnet (previous bouncer implementation)
// ---------------------------------------------------------------------------
class LinearScanDB {
    private selectors: Array<{ selector: Address4; value: Decision }> = [];

    insert(ip: string, value: Decision) {
        this.selectors.push({ selector: ip4(ip), value });
    }

    lookup(ip: string): Decision | undefined {
        const target = ip4(ip);
        return this.selectors.find(({ selector }) => target.isInSubnet(selector))?.value;
    }
}

// ---------------------------------------------------------------------------
// 2. Map<mask, Map<network, Array<Decision>>> — current IpDecisionDB style
// ---------------------------------------------------------------------------
class MapOfMaps {
    private masks = new Map<number, Map<number, Array<Decision>>>();
    private activeMasks: Array<number> = [];
    private minMask: number;

    constructor(minMask = 0) {
        this.minMask = minMask;
    }

    insert(ip: string, value: Decision) {
        const ipObject = ip4(ip);
        const mask = ipObject.subnetMask;
        if (mask < this.minMask) return;
        const key = toU32(ip) >>> (32 - mask);
        let bucket = this.masks.get(mask);
        if (!bucket) {
            bucket = new Map();
            this.masks.set(mask, bucket);
            this.activeMasks.push(mask);
            this.activeMasks.sort((a, b) => b - a);
        }
        let list = bucket.get(key);
        if (!list) {
            list = [];
            bucket.set(key, list);
        }
        list.push(value);
    }

    lookup(ip: string): Decision | undefined {
        const ipNum = toU32(ip);
        for (const mask of this.activeMasks) {
            const d = this.masks.get(mask)?.get(ipNum >>> (32 - mask));
            if (d && d.length) return d[0];
        }
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// 3. Map<mask, Map<network, SMI>> — values packed in a single number
// ---------------------------------------------------------------------------
class MapSMI {
    private masks = new Map<number, Map<number, number>>();
    private activeMasks: Array<number> = [];
    private values = new Map<number, Decision>();

    insert(ip: string, value: Decision) {
        const ipObject = ip4(ip);
        const mask = ipObject.subnetMask;
        const key = toU32(ip) >>> (32 - mask);
        const id = this.values.size;
        this.values.set(id, value);
        let bucket = this.masks.get(mask);
        if (!bucket) {
            bucket = new Map();
            this.masks.set(mask, bucket);
            this.activeMasks.push(mask);
            this.activeMasks.sort((a, b) => b - a);
        }
        if (!bucket.has(key)) bucket.set(key, id);
    }

    lookup(ip: string): Decision | undefined {
        const ipNum = toU32(ip);
        for (const mask of this.activeMasks) {
            const id = this.masks.get(mask)?.get(ipNum >>> (32 - mask));
            if (id !== undefined) return this.values.get(id);
        }
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// 4. Sorted Uint32Array per mask + binary search + SoA values
// ---------------------------------------------------------------------------
class SortedU32 {
    private byMask = new Map<number, Uint32Array>();
    private countByMask = new Map<number, number>();
    private activeMasks: Array<number> = [];
    private types: Array<number> = [];
    private untils: Array<number> = [];
    private idByKey = new Map<string, number>();

    insert(ip: string, value: Decision) {
        const ipObject = ip4(ip);
        const mask = ipObject.subnetMask;
        const key = toU32(ip) >>> (32 - mask);
        const id = this.idByKey.size;
        this.idByKey.set(`${mask}:${key}`, id);
        this.types[id] = value.type;
        this.untils[id] = value.until;

        if (!this.byMask.has(mask)) {
            this.byMask.set(mask, new Uint32Array(1024));
            this.countByMask.set(mask, 0);
            this.activeMasks.push(mask);
            this.activeMasks.sort((a, b) => b - a);
        }
        const arr = this.byMask.get(mask)!;
        let count = this.countByMask.get(mask)!;
        if (count >= arr.length) {
            const grown = new Uint32Array(arr.length * 2);
            grown.set(arr);
            this.byMask.set(mask, grown);
        }
        arr[count] = key;
        this.countByMask.set(mask, count + 1);
        let j = count;
        while (j > 0 && arr[j - 1] > key) {
            arr[j] = arr[j - 1];
            j--;
        }
        arr[j] = key;
    }

    lookup(ip: string): Decision | undefined {
        const ipNum = toU32(ip);
        for (const mask of this.activeMasks) {
            const arr = this.byMask.get(mask)!;
            const count = this.countByMask.get(mask)!;
            const key = ipNum >>> (32 - mask);
            let lo = 0;
            let hi = count - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (arr[mid] === key) {
                    const id = this.idByKey.get(`${mask}:${key}`)!;
                    return { type: this.types[id], until: this.untils[id] };
                }
                if (arr[mid] < key) lo = mid + 1;
                else hi = mid - 1;
            }
        }
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// 5. Custom open-addressing hash (SoA) — cap 2x, per mask
// ---------------------------------------------------------------------------
class OpenHash {
    private keys = new Uint32Array(65536);
    private occupied = new Uint8Array(65536);
    private types = new Uint32Array(65536);
    private untils = new Uint32Array(65536);
    private byMask = new Map<number, OpenHash>();
    private activeMasks: Array<number> = [];

    private static hash(key: number, size: number) {
        let h = key;
        h = (h ^ (h >>> 16)) * 0x7feb352d;
        h = h >>> 0;
        return h & (size - 1);
    }

    private getTable(mask: number): OpenHash {
        if (!this.byMask.has(mask)) {
            this.byMask.set(mask, new OpenHash());
            this.activeMasks.push(mask);
            this.activeMasks.sort((a, b) => b - a);
        }
        return this.byMask.get(mask)!;
    }

    insert(ip: string, value: Decision) {
        const ipObject = ip4(ip);
        const mask = ipObject.subnetMask;
        const table = this.getTable(mask);
        const key = toU32(ip) >>> (32 - mask);
        let idx = OpenHash.hash(key, table.keys.length);
        while (table.occupied[idx]) {
            if (table.keys[idx] === key) return;
            idx = (idx + 1) & (table.keys.length - 1);
        }
        table.occupied[idx] = 1;
        table.keys[idx] = key;
        table.types[idx] = value.type;
        table.untils[idx] = value.until;
    }

    lookup(ip: string): Decision | undefined {
        const ipNum = toU32(ip);
        for (const mask of this.activeMasks) {
            const table = this.byMask.get(mask)!;
            const key = ipNum >>> (32 - mask);
            let idx = OpenHash.hash(key, table.keys.length);
            while (table.occupied[idx]) {
                if (table.keys[idx] === key) {
                    return { type: table.types[idx], until: table.untils[idx] };
                }
                idx = (idx + 1) & (table.keys.length - 1);
            }
        }
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------
const DECISIONS = 50000;
const TARGETS = 20000;

const buildDecisions = () => {
    const exact: string[] = [];
    const ranges: string[] = [];
    for (let i = 0; i < DECISIONS; i++) {
        const a = i % 256;
        const b = Math.floor(i / 256) % 256;
        if (i % 20 === 0) ranges.push(`10.${b}.${a}.0/24`);
        else exact.push(`10.${b}.${a}.128`);
    }
    return { exact, ranges };
};

/** banned /32 ips (hit), plus some legit ips (miss) */
const buildHitTargets = () => {
    const targets: string[] = [];
    for (let i = 0; i < TARGETS; i++) {
        const a = i % 256;
        const b = Math.floor(i / 256) % 256;
        targets.push(`10.${b}.${a}.128`);
    }
    return targets;
};

const buildMissTargets = () => {
    const targets: string[] = [];
    for (let i = 0; i < TARGETS; i++) {
        const a = i % 256;
        const b = Math.floor(i / 256) % 256;
        targets.push(`192.168.${a}.${b + 1}`);
    }
    return targets;
};

const decision = (i: number): Decision => ({ type: i % 3, until: 1750000000 + i });

const STRUCTURES = [
    { name: 'LinearScan isInSubnet (baseline)', make: () => new LinearScanDB() },
    { name: 'MapOfMaps (current IpDecisionDB)', make: () => new MapOfMaps() },
    { name: 'MapSMI (packed value)', make: () => new MapSMI() },
    { name: 'SortedU32 + binary search + SoA', make: () => new SortedU32() },
    { name: 'OpenHash open-addressing SoA', make: () => new OpenHash() }
];

const buildAll = (exact: string[], ranges: string[]) => {
    let i = 0;
    return STRUCTURES.map(({ name, make }) => {
        const db = make();
        for (const ip of exact) db.insert(ip, decision(i++));
        for (const ip of ranges) db.insert(ip, decision(i++));
        return { name, db };
    });
};

const benchLookups = (label: string, targets: string[]) => {
    const { exact, ranges } = buildDecisions();
    const built = buildAll(exact, ranges);

    const suite = new Benchmark.Suite(label);
    let cursor = 0;
    for (const { name, db } of built) {
        suite.add(name, () => {
            db.lookup(targets[cursor++ % targets.length]);
        });
    }
    console.log(`\n## ${label}`);
    suite
        .on('cycle', (event: Benchmark.Event) => console.log('   ' + String(event.target)))
        .on('complete', function (this: Benchmark.Suite) {
            console.log('   Fastest is ' + this.filter('fastest').map('name'));
        });
    // run each benchmark separately so one slow structure does not stall the suite
    return new Promise<void>((resolve) => {
        suite
            .on('complete', () => resolve())
            .run({ async: true, defer: false, minSamples: 20, maxTime: 3 });
    });
};

const benchSetup = async () => {
    const { exact, ranges } = buildDecisions();
    const suite = new Benchmark.Suite('db setup (insert + index 50k decisions)');
    for (const { name, make } of STRUCTURES) {
        suite.add(name, () => {
            const db = make();
            let i = 0;
            for (const ip of exact) db.insert(ip, decision(i++));
            for (const ip of ranges) db.insert(ip, decision(i++));
        });
    }
    console.log('\n## db setup (insert + index 50k decisions)');
    suite
        .on('cycle', (event: Benchmark.Event) => console.log('   ' + String(event.target)))
        .on('complete', function (this: Benchmark.Suite) {
            console.log('   Fastest is ' + this.filter('fastest').map('name'));
        });
    await new Promise<void>((resolve) => {
        suite
            .on('complete', () => resolve())
            .run({ async: true, defer: false, minSamples: 20, maxTime: 3 });
    });
};

const benchSubnetLevels = async (targets: string[]) => {
    const { exact, ranges } = buildDecisions();
    // map each level to the minMask it enforces (resident=32, company=24, country=16)
    const levels = [
        { name: 'resident (/32 only)', minMask: 32 },
        { name: 'company (up to /24)', minMask: 24 },
        { name: 'country (up to /16)', minMask: 16 }
    ];

    for (const level of levels) {
        const db = new MapOfMaps(level.minMask);
        let i = 0;
        for (const ip of exact) db.insert(ip, decision(i++));
        for (const ip of ranges) db.insert(ip, decision(i++));

        const suite = new Benchmark.Suite(`subnetLevel ${level.name}`);
        let cursor = 0;
        suite.add(`hit lookup`, () => {
            db.lookup(targets[cursor++ % targets.length]);
        });
        console.log(`\n## subnetLevel : ${level.name}`);
        await new Promise<void>((resolve) => {
            suite
                .on('cycle', (event: Benchmark.Event) => console.log('   ' + String(event.target)))
                .on('complete', () => resolve())
                .run({ async: true, defer: false, minSamples: 20, maxTime: 2 });
        });
    }
};

const run = async () => {
    console.log(`Dataset : ${DECISIONS} decisions (95% /32, 5% /24), ${TARGETS} targets`);
    await benchLookups('hit lookup (banned ip)', buildHitTargets());
    await benchLookups('miss lookup (legitimate ip)', buildMissTargets());
    await benchSubnetLevels(buildHitTargets());
    await benchSetup();
};

run();
