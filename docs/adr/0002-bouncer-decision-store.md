# ADR-0002 : Bouncer decision store — numeric prefix index with walk-up lookup

- **Status** : Accepted
- **Date** : 2026-08-16

## Context

The bouncer middleware receives **tens of thousands of IPs to check**, each one
against the full set of decisions cached from the LAPI stream. A bouncer must
answer in a few microseconds and must **never block the event loop**.

The initial implementation iterated over every decision per lookup:

```ts
(this.decisions[currentAddress.parsedAddress[0]] || []).find(({ selector }) =>
    currentAddress.isInSubnet(selector)
);
```

With 50k decisions this cost ~90–185 ms per lookup (measured) — unacceptable.

### Distribution of real-world decision sets

Before optimizing, we reasoned about the *actual* data:

- Malicious IPs are overwhelmingly **single /32** (individual scanners, bots,
  compromised hosts). This is the dominant case.
- Larger blocks follow the hierarchy of who owns them:
  - **/32** : individual attacker / single compromised machine.
  - **/24 – /16** : an ISP, a hosting/cloud provider block (e.g. AWS, OVH,
    a country-wide telecom). A provider block can be flagged when it hosts
    abusive customers, but this is far rarer than single IPs.
  - **/16 – /8** : large national/regional allocations. In practice almost never
    malicious; would only make sense for an entire hostile country (state
    adversary) — an extreme edge case.
- **Cross-boundary ranges** (a single CIDR whose prefix does not align to the
  top octet, e.g. `0.0.0.0/7` covering `0.x` and `1.x`) are effectively fiction:
  no realistic actor has a malicious block that straddles the top-level boundary.
  The previous bucketing (`parsedAddress[0]`) silently failed for such ranges,
  which is acceptable in practice — but our new design handles them correctly for
  free, so the limitation disappears.

### IPv6 note

Malicious IPv6 exists but is **light** : a real bouncer typically holds a few
dozen to a few hundred IPv6 decisions, versus tens of thousands of IPv4 ones.
The 128-bit space is not enumerable by scanners, so almost all attacks still
come from IPv4. IPv6 support is kept for correctness (and for IPv4-mapped
sockets, see the `getIpObject` normalization), but it is not an optimization
target.

This is unlikely to change soon: a successor protocol was announced — **IPv8**
(IETF Internet-Draft `draft-thain-ipv8`, April 2026) proposes 64-bit addresses
with full IPv4 backward compatibility and no forced migration. IPv8 may well
arrive before malicious IPv6 ever becomes a significant workload, so
investing heavily in IPv6 lookup performance is not justified today.

## Decision

Store decisions in an in-memory index (`IpDecisionDB`) keyed by **numeric
address**, and match by **walking up** from the most specific mask to the least
specific one.

### Why numbers

An IP is a number (32-bit IPv4, 128-bit IPv6) and a CIDR is a prefix of bits. A
plain JS `number` is exact for IPv4 (< 2³²), so bit math uses native `>>>`
(shifts on a `bigint` are ~10x slower, measured). IPv6 values stay `bigint` and
are shifted with `BigInt`.

The numeric representation of an address is computed **once** and cached
(`WeakMap` keyed by `AddressObject`). This pairs with `IpObjectsCacher`, which
already returns the same `AddressObject` instance for a given IP string.

### Why walk-up instead of a trie

We first prototyped a binary prefix trie (O(bits) per lookup). It worked, but a
walk-up index is simpler and faster for this distribution:

- Decisions are grouped per **mask length** : `masks.get(mask)` is a `Map` whose
  key is the network part (`ip >>> (bitWidth - mask)`), whose value is the list
  of decisions for that exact network.
- A lookup iterates the **active** mask lengths, most specific first (typically
  `[/32, /24, /16, /8]`), and stops at the first hit.
- A /32 hit therefore costs a **single Map lookup** (~30–60 ns measured,
  ~0.9 µs per full 50k-lookup when including cache reads).

```ts
// insert
const key = ip >>> (32 - mask);           // ipv4 ; or ip >> BigInt(128 - mask) for ipv6
masks.get(mask).get(key).push(decision);

// lookup — walk up, most specific first
for (const mask of activeMasks) {
    const hit = masks.get(mask)?.get(ip >>> (32 - mask));
    if (hit) return hit[0];
}
```

### Configurability of the maximum mask

Because real malicious blocks are almost always `/32`, an operator may want to
limit matching to masks `>= N` (e.g. ignore country-sized `/8` decisions to avoid
over-blocking). This is exposed as the `subnetLevel` option on the bouncer
middleware, with three presets:

- `resident`  → only `/32` (an individual attacker);
- `company`   → up to `/24` (an ISP / hosting block); **default**;
- `country`   → up to `/16` (a national block).

The filter is applied **at insert time** in `addDecision`: decisions whose mask
is smaller than the configured level are never stored. Because the middleware
configuration is immutable after construction (no setters, like every other
option: `pollingInterval`, `maxIpCache`...), changing `subnetLevel` requires
**restarting the middleware** — this is not a new constraint, it is the existing
behavior for all options. Insert-time filtering keeps the index small and
`decisionsCount` accurate.

### Live mode

The stream poll bounds freshness to the polling interval. To close that gap, an
optional **live mode** (`live.enabled`) checks unknown IPs against the LAPI
(`GET /v1/decisions?ip=<ip>`) in the background :

- On a local miss, the current request **always passes** (the check runs in the
  background, never blocking the request path).
- If the LAPI says the IP is banned, the decision is injected through the **same
  `addDecision` path** as the stream (deduplicated by `value:type`) → the *next*
  request from that IP is blocked. A malicious unknown IP passes once, never twice.
- If the IP is clean, the verdict is cached (`cleanCache`, LRU + TTL, default 60s)
  so the LAPI is not re-queried for returning visitors.
- **Thundering herd** : pending live checks are deduplicated per IP and capped
  globally (`live.maxConcurrentChecks`, default 100) — 10k concurrent requests
  for the same unknown IP trigger a single LAPI call.
- **Failure behavior** is configurable : `failOpen` (default) caches the failure
  for a short backoff (`live.errorBackoffTtl`, 10s) so a down LAPI is not hammered ;
  `failFast` re-checks on every request.
- **Safety net** : a periodic scan (`live.watchdog`, default on) removes expired
  decisions from the index, because if the LAPI goes down the stream `deleted`
  events stop coming and an injected decision would otherwise live forever. A
  single unref'd interval walks the index (instead of one timer per decision),
  so long durations and renewals need no special handling. Although exposed
  under the `live` block, it applies in stream mode too.
- The cache clean is never able to mask a ban : the local index is checked
  **first**, the clean cache only after a full miss.

Live mode is fully configurable under the `live` option block (enabled, TTLs,
cache sizes, concurrency, failure behavior, watchdog). Default is disabled for
backward compatibility with the pure stream mode.

## Consequences

### Positive

- **Lookup is O(active mask lengths)** instead of O(50k decisions): tens of
  thousands of IPs are checked in ~40 ms, and the event loop is never blocked
  (measured: 0 ms gap on a 1 ms monitor during 50k lookups).
- Correct for any mask, including cross-boundary ranges (free correctness, not a
  design goal).
- Simple, no node allocations during lookup (numeric cache is per-address).

### Limits

- Insertion is slower than lookup (~50k inserts ≈ 0.8–1.2 s on first load). This
  happens once, when the stream arrives, and is not on the request path.
- `subnetLevel` is fixed at construction : changing it requires restarting the
  middleware (consistent with all other options).
- IPv6 is supported but not optimized (fine given IPv6 malicious traffic is rare).

## Alternatives considered

- **Full linear scan with `isInSubnet`** (previous implementation): 90–185 ms
  per lookup. Rejected.
- **Binary prefix trie**: correct and fast (~240 ns), but more complex (node
  allocation, WeakMap chunk cache) for the same result as the walk-up index.
  Rejected for simplicity.
- **Map only for `/32` + linear scan for ranges**: nearly as fast in the common
  case, but degrades when ranges exist and needs two code paths. The walk-up
  index unifies both in a single structure.
