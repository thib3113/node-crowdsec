# AI Agent Setup Guide — CrowdSec HTTP Middleware

Give this guide to your AI agent when you want to configure the
`crowdsec-http-middleware` bouncer. It first helps the user decide whether this
library is the right tool at all (Step 0), then walks the agent through the
questions that actually matter, with the recommended defaults, so it can produce
a configuration that fits your use case instead of guessing.

The agent MUST ask the questions below (in order) and only fall back to the
recommended defaults when the user has no opinion. If the user's answer to
Step 0 shows this library is not the right tool, **stop** and recommend the
simpler alternative instead of configuring anyway.

---

## Step 0 — Do you even need this library ?

Before configuring anything, help the user decide whether `node-crowdsec` is the
right tool. Ask **one** of these questions first :

### 0.1 What are you actually trying to do ?

- **"Block a few bad IPs / a small static blocklist"** → you probably do **not**
  need a CrowdSec bouncer at all. A firewall rule (fail2ban, iptables), a WAF
  (Cloudflare, ModSecurity) or a small hardcoded list is simpler.
- **"Protect my web server against scanners / brute-force / malicious traffic,
  with community-sourced signals"** → CrowdSec is a good fit. Continue.
- **"I already run a CrowdSec LAPI and want my Node.js app to use its
  decisions"** → this library (or the official
  `@crowdsec/nodejs-bouncer`) is the right tool. Continue.
- **"Block at the network level (firewall, fail2ban)"** → CrowdSec's own
  bouncers (cs-firewall-bouncer, etc.) are more appropriate than a Node.js
  in-app bouncer.

### 0.2 Is an in-app (application-level) bouncer right for you ?

`crowdsec-http-middleware` works **inside your Node.js HTTP server** : it inspects
requests and sets `req.decision` (your code decides the final response). Consider
whether that fits :

- **Good fit** : Node.js server, you want fine-grained control, or you cannot
  install a system-level bouncer.
- **Key advantage — you stay in control of the response.** A network-level
  bouncer (firewall / nginx / CDN) cuts the request before it reaches your app :
  the visitor gets a generic 403 and that's it. With this library the request
  still reaches your code and `req.decision` tells you *why* (`ban`, `captcha`,
  `bypass`), so **you** decide what the visitor sees :
  - a custom branded ban page ;
  - a **captcha flow** (e.g. render your own captcha, verify it, remember the
    solved IP for a while) ;
  - a redirect to a login / info page ;
  - a JSON error for an API, instead of an HTML page ;
  - different status codes per decision type.
  This is impossible (or very awkward) with a firewall / reverse-proxy bouncer.
- **Poor fit** : you have a reverse proxy / CDN in front (nginx, Traefik,
  Cloudflare) that could block earlier at the network layer — blocking there is
  more efficient and keeps the load off your app. Use CrowdSec's
  nginx/caddy/cloudflare bouncers instead, **unless** you need the app-level
  control above (captcha, custom page) — in which case keep this library.

### 0.3 This library vs the official `@crowdsec/nodejs-bouncer` ?

Both are Node.js bouncers. Rough comparison to present to the user :

| | `@crowdsec/nodejs-bouncer` (official) | `crowdsec-http-middleware` (this repo) |
|---|---|---|
| Default mode | live (one LAPI call per new IP, then cache) | stream (local index, ~µs/request) |
| Freshness | immediate on cache miss | bounded by `pollingInterval` |
| LAPI load | grows with unique IPs | constant (one poll per interval) |
| Live mode option | — | yes, on top of the stream |
| `subnetLevel` | — | yes (avoid banning whole countries) |
| Watcher / scenarios | no | yes (detect & report) |
| Typed events / fine config | basic | extensive |

Rule of thumb : if you want the **lowest LAPI load and fastest local checks**,
or you need the **watcher**, use this library. If you want the simplest possible
setup with immediate freshness and don't mind the per-IP LAPI calls, the official
bouncer is fine.

---

## What you are setting up

`crowdsec-http-middleware` protects an HTTP server with CrowdSec. It runs a
**bouncer** (blocks requests from flagged IPs) and optionally a **watcher**
(detects malicious requests and alerts the LAPI).

The important behavioral levers are :

- **How the bouncer knows an IP is malicious** : stream mode (default, decisions
  are pulled periodically from the LAPI and matched locally, ~µs/request) or
  live mode (unknown IPs are also checked on demand in the background).
- **How far up the CIDR hierarchy a block is trusted** : `subnetLevel`.
- **How the IP is extracted from the request** (behind a proxy or not).

---

## Questions to ask (in order)

### 1. Application context

- What is the application ? (public website, API, admin panel...)
- Expected traffic : ~requests/second at peak ?
- Can the LAPI handle bursts of extra requests, or should it stay low-traffic ?
- Is this a new deployment or are we migrating an existing bouncer config ?

### 2. How do you want to detect malicious IPs ?

> **Recommended** : stream mode (default). It is fast, cheap on the LAPI, and
> the freshness gap (≤ polling interval) is acceptable for almost everyone.

- **Stream mode** (recommended) : the bouncer pulls decisions every
  `pollingInterval` (default 10 s) and matches locally. Zero LAPI load per
  request. An IP banned between two polls is seen up to `pollingInterval` later.
- **Live mode** (`live.enabled: true`) : on top of the stream, unknown IPs are
  checked against the LAPI in the background. A malicious unknown IP passes
  **once** and is blocked from the next request. Costs one LAPI call per new IP
  (cached clean verdicts for 60 s). Use it when the polling gap is not acceptable
  and the LAPI can absorb the load.

Ask : is it acceptable that a brand-new ban takes up to `pollingInterval`
(10 s default) to apply ? If no → enable live mode.

### 3. What is the largest block you consider malicious ?

> **Recommended** : `company` (up to `/24`).

Real-world malicious traffic is almost always single IPs (`/32`). Larger blocks
follow who owns them : an abusive datacenter rack is a `/24`, an entire national
block is `/8` — banning a whole country is almost never intended.

- `resident` : only single IPs (`/32`). Most restrictive on false positives.
- `company` (recommended) : up to `/24` (an ISP / hosting provider block).
- `country` : up to `/16` (only if you really mean to block national blocks).

Ask : are your attackers mostly individual IPs, or do you need to block ranges
(an abusive hosting provider) ? Would blocking a whole `/8` ever be OK ?

### 4. Where does the IP come from ?

- Direct connection : use `req.socket.remoteAddress` (default).
- Behind a proxy / reverse proxy / CDN : you MUST tell the agent which header
  carries the client IP (`X-Forwarded-For`, `CF-Connecting-IP`...) and whether
  the proxy is trusted. Wrong extraction = wrong blocks.

Ask : is the server directly exposed, or behind a proxy/CDN ? If behind one,
which header holds the real client IP ?

### 5. Bouncer authentication

- `apiKey` (recommended) : simplest, from the LAPI bouncer config.
- TLS certificate (`key`/`cert`/`ca`) : if your setup uses mTLS.

### 6. Failure behavior (live mode only)

> **Recommended** : `failOpen` (default). If the LAPI is down, requests pass and
> are not re-checked for 10 s (backoff).

- `failOpen` (recommended) : failed live checks are remembered for
  `errorBackoffTtl` (10 s) so a down LAPI is not hammered. Requests pass.
- `failFast` : every request re-triggers a live check. Only if you prefer
  freshness over protecting the LAPI.

Ask (only if live mode is on) : if the LAPI is temporarily unreachable, is it
acceptable that requests pass silently ? If yes → `failOpen`, if no →
`failFast` and a shorter backoff.

### 7. Watcher (optional)

- Do you want to *detect and report* malicious requests to the LAPI (not just
  block) ? If yes, a watcher with scenarios is needed.
- Which default scenarios ? (`crowdsec-client-scenarios` provides user-agent
  based ones). Or custom scenarios ?

Ask : do you need the application to *report* suspicious requests (watcher), or
only to *block* flagged IPs (bouncer) ?

### 8. Caching / memory budget (advanced)

- How much memory is acceptable for the bouncer caches ? Roughly :
  - `maxIpCache` (parsed IP objects, default 50 000) ~ a few MB.
  - `live.cleanCacheMax` (clean verdicts, default 50 000) ~ a few MB.
- Adjust if the deployment is memory-constrained or very high-traffic.

---

## Output the agent should produce

After the interview, produce :

1. A `CrowdSecHTTPMiddleware` configuration object, with every answered
   question mapped to an option and the recommended defaults for the rest.
2. A short justification (2-3 lines) for the key choices (`live`, `subnetLevel`).
3. The `getCurrentIp` function if the deployment is behind a proxy.

### Reference: full option surface

```typescript
const middlewareOptions: ICrowdSecHTTPMiddlewareOptions = {
    url: process.env.CROWDSEC_URL,
    clientOptions: { strictSSL: true, timeout: 2000 },
    getCurrentIp: (req) => req.socket.remoteAddress || '0.0.0.0',
    bouncer: {
        apiKey: process.env.CROWDSEC_API_KEY || '',
        pollingInterval: 10000,                      // ms, stream pull period
        subnetLevel: SubnetLevel.company,            // resident | company | country
        live: {
            enabled: false,                          // true to enable live checks
            errorBehavior: LiveCheckErrorBehavior.failOpen, // failOpen | failFast
            cleanCacheTtl: 60,                       // seconds, clean verdict TTL
            cleanCacheMax: 50000,                    // LRU max clean verdicts
            maxConcurrentChecks: 100,                // global live check cap
            errorBackoffTtl: 10,                     // seconds, failed-check backoff
            watchdog: true                           // expire live decisions on their own
        }
    },
    watcher: {
        machineID: process.env.CROWDSEC_WATCHER_MACHINE_ID || '',
        password: process.env.CROWDSEC_WATCHER_PASSWORD || '',
        heartbeat: true,
        scenarios: []                                // default scenarios
    }
};
```

### Defaults summary (when the user has no opinion)

| Option | Default | Why |
|---|---|---|
| `pollingInterval` | 10 s | reasonable freshness for stream mode |
| `subnetLevel` | `company` (/24) | real attackers are single IPs, not countries |
| `live.enabled` | `false` | stream mode is enough for most deployments |
| `live.errorBehavior` | `failOpen` | don't hammer a down LAPI |
| `live.cleanCacheTtl` | 60 s | matches the official bouncer |
| `live.cleanCacheMax` | 50 000 | bounded memory |
| `live.maxConcurrentChecks` | 100 | avoids thundering herd on the LAPI |
| `live.errorBackoffTtl` | 10 s | fail-open backoff |
| `live.watchdog` | `true` | safety net if the LAPI stays down |

---

## Pitfalls the agent must check before writing code

- **IP extraction behind a proxy** is the #1 source of wrong blocks : never use
  `X-Forwarded-For` blindly (spoofable if the proxy is not trusted). If unsure,
  ask again.
- `subnetLevel` is fixed at construction time : changing it requires restarting.
- Live mode is **not** synchronous : the current request always passes, the ban
  applies from the *next* request. Do not promise an immediate 403 to the user.
- Do not enable live mode if the LAPI cannot absorb `new-IPs-per-second` × 1
  request.
