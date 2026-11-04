# CrowdSec LAPI version compatibility

Records the LAPI version each client capability requires and the behaviour when
the connected LAPI is older. Update it when a package uses a new endpoint,
parameter or response field.

Tested range: `v1.0.0` … `v1.8.x`; the exact live matrix is the curated list in
`.github/scripts/lapi-matrix/versions.txt`.

## Why detection is needed

The LAPI does not expose a queryable version: `GET /health` is unversioned,
`GET /v1/heartbeat` only returns `200` (from v1.4.0), and
`LapiMetrics.features` (v1.8.2) is a metrics payload, not a capability list. The
client must therefore be told the version, probe, or fail lazily.

## Failure semantics

| Situation | Status | Body |
| --- | --- | --- |
| Unknown route | `404` | `Page or Method not found` |
| Unknown method | `405` | method not allowed |
| Unknown filter parameter | `500` | database filter error |
| Alert delete from a non-trusted host | `403` | restricted to the LAPI host / `TrustedIPs` |
| Unknown JSON field | `2xx` | silently ignored |
| Filter not read by the handler | `2xx` | ignored, results wider than requested |

Unknown filters are **not** `400`. Route-`404` and object-`404` differ only by
message; never treat `/not found/i` as "object not found" without checking it.

## Capability matrix

`code` is the first release where the behaviour works; `swagger` is when it was
documented. Gate on `code`.

### Endpoints

| Capability | Code | If older |
| --- | --- | --- |
| `POST /v1/watchers/login`, `POST /v1/watchers` | 1.0.0 | — |
| `registration_token` in registration | 1.6.3 | ignored silently |
| `GET /v1/heartbeat` | 1.4.0 | `404`, the client disables the heartbeat loop |
| `DELETE /v1/watchers/self` | 1.6.9 | `404` |
| `GET /v1/decisions/stream`, `GET /v1/decisions` | 1.0.0 | — |
| `DELETE /v1/decisions`, `DELETE /v1/decisions/{id}` | 1.0.0 | — |
| `POST /v1/alerts`, `GET /v1/alerts[/{id}]`, `HEAD /v1/alerts`, `HEAD /v1/decisions` | 1.0.0 | — |
| `DELETE /v1/alerts` | 1.0.0 | `403` from a remote host |
| `DELETE /v1/alerts/{id}` | 1.4.2 | `405` before 1.4.2, `403` remotely |
| `GET /v1/allowlists`, `GET /v1/allowlists/{name}`, `GET /v1/allowlists/check/{value}` | 1.6.6 | `404` |
| `POST /v1/allowlists/check` (bulk) | 1.6.9 | `404`/`405` |

### Query parameters

| Parameter | Endpoint(s) | Code | If older |
| --- | --- | --- | --- |
| `contains` | `GET/DELETE /decisions`, `GET/DELETE /alerts` | 1.0.3 | `500` |
| `scopes` (stream) | `GET /decisions/stream` | 1.1.0 | silently ignored |
| `origin` | `GET /alerts` | 1.3.0 | `500` |
| `origins`, `scenarios_containing`, `scenarios_not_containing` | `GET /decisions`, stream | 1.3.3 | `500` on `/decisions`, ignored on stream |
| `scenario` | `DELETE /decisions` | 1.4.2 | `500` |
| `kind` | `GET /alerts` | 1.7.7 | `500` |
| `scope` (singular, list) | `GET /decisions` | 1.0.0, ignored 1.3.3–1.6.0, restored 1.6.1 | silently ignored (set too wide) |
| `scope` (singular, delete) | `DELETE /decisions` | 1.0.0, removed 1.3.3 | `500`; use `scopes` |
| `scopes` (delete) | `DELETE /decisions` | 1.3.3 | `500`; use `scope` |
| `alert_source` | `DELETE /alerts` | never implemented | `500` on every version; use `origin` |
| `simulated` | `GET /decisions` | 1.0.0 | ignored; simulated decisions stay excluded unless `true` |
| `with_content` | `GET /allowlists[/{name}]` | 1.6.6 | — |

`GET /v1/decisions` silently ignores the *known* `scope` parameter on
1.3.3–1.6.0, unlike `/v1/alerts` and the DELETE routes. A request that relies on
it therefore returns a wider result instead of an error. Unknown parameters are
rejected with the `500` listed above. Because `scope` is ignored on that range,
the MCP `list_decisions` tool routes a `scope` query to the watcher alert scan
whenever watcher credentials are available.

`Decisions.delete` maps `scope`/`scopes` through the `decisionScopesDelete`
capability (1.3.3), then falls back on the specific `500 invalid filter` and
caches the result. `CROWDSEC_LAPI_VERSION` makes the choice deterministic.

### Response fields

| Field | Model | Code | If older |
| --- | --- | --- | --- |
| `until` | `Decision` | 1.3.0 | `undefined`; compute `endAt` from `duration` |
| `uuid` | `Alert`, `Decision` | 1.5.0 | `undefined` |
| `kind` | `Alert` | 1.7.7 | `undefined` |
| `simulated` | `Decision` | always stored | `/v1/decisions` excludes simulated by default and omits the field |
| `deleted` | `DecisionsStreamResponse` | 1.1.0 (optional) | absent or `null` on old releases |
| `features` | `LapiMetrics` | 1.8.2 | `undefined` |

`/v1/decisions` may omit `until` even when the model has it (observed on 1.8.1).

## Write/delete asymmetry

Creating a decision works on every supported LAPI (`POST /v1/alerts`, 1.0.0).
Deleting it is gated, and alert deletion is restricted to the LAPI host:

| Delete path | Minimum | Notes |
| --- | --- | --- |
| `DELETE /v1/decisions/{id}` | 1.0.0 | requires the decision id |
| `DELETE /v1/decisions?scope=` | 1.0.0 | singular, removed in 1.3.3 |
| `DELETE /v1/decisions?scopes=` | 1.3.3 | plural, learned by `Decisions.delete` |
| `DELETE /v1/decisions?scenario=` | 1.4.2 | |
| `DELETE /v1/alerts/{id}` | 1.4.2 | |
| `DELETE /v1/alerts` | 1.0.0 | LAPI host / `TrustedIPs` only |

Deletes filtered by `ip`/`range` send `contains=false` to mean "decisions
contained within the value". `Alerts.delete` and `Decisions.delete` add this
default automatically; pass `contains: true` to opt into the wider LAPI
behaviour. That parameter needs 1.0.3: on 1.0.0-1.0.2 the request fails instead
of silently widening the delete to a Range decision that contains the value.

A client can therefore **create a decision it cannot delete**: the decision
stays active until its `duration` expires. Mitigations: use a short `duration`,
delete by decision id, or gate creation on `supports('alertDeleteById')` /
`supports('decisionScenarioDelete')`.

## Handling an unsupported capability

Apply this order. Never silently drop a filter that changes the meaning of a
write.

1. **Declare the version.** `lapiVersion` resolves every capability locally,
   without a request. A capability known to be unsupported always throws
   `FeatureNotSupportedError`; `strictCapabilities` additionally makes
   capabilities that could not be verified throw `LapiVersionUnknownError`.
2. **Probe after login and cache.** `detectCapabilities: true` probes once after
   login; the result is cached per client instance. Calling
   `detectCapabilities()` again re-probes and merges the result, except when a
   version was declared (it returns immediately); use
   `detectCapability(name, { force: true })` to verify a single capability.
3. **Fall back** to an equivalent endpoint or a narrower request when one
   exists (see the fallback catalogue).
4. **Raise a typed error.** `FeatureNotSupportedError`
   (`EErrorsCodes.FEATURE_NOT_SUPPORTED`) carries `capability`,
   `minimumVersion` and `detectedVersion`. In strict mode an unverifiable
   capability throws `LapiVersionUnknownError`.
5. **Degrade explicitly.** Fail or emit a warning; do not let the server ignore
   a filter silently.

```ts
const watcher = new WatcherClient({
    url: 'https://lapi:8080',
    auth: { machineID, password },
    detectCapabilities: true,   // probe after login
    // lapiVersion: '1.6.6',    // or declare it: no probe is sent
    // strictCapabilities: true // fail when a capability is unknown
});

await watcher.login();

watcher.getCapabilities(); // { source: 'probed', values: { allowlists: true, ... } }
watcher.supports('allowlists'); // true | false | undefined
watcher.getProbableVersion(); // { minVersion: '1.6.9', belowVersion: '1.7.7' }
```

Detection propagates through the version ordering: seeing `allowlists` work
implies every capability up to 1.6.6; seeing it fail implies everything from
1.6.6 upwards is unavailable. A value learned from a real request (`learn`) is
**not** propagated: a single rejected request must not disable unrelated
features. It sets `source` to `observed` when no probe has run and leaves
`probed` in place otherwise; it can correct a value that was only inferred, but
never a declared or explicitly probed one. Capabilities that no probe can reach
(mainly `alertDeleteById` and `decisionScenarioDelete`) stay `undefined` unless
the version is declared. The client never sends a `DELETE` as a probe.

## Probe catalogue

| Capability | Probe | Interpretation |
| --- | --- | --- |
| `contains` | `GET /v1/decisions?ip=192.0.2.1&contains=false` | `2xx` supported, `500` not |
| decisions `origins` | `GET /v1/decisions?origins=node-crowdsec-probe` | `2xx` supported, `500` not |
| alert `origin` | `GET /v1/alerts?origin=cscli&limit=1` | `2xx` supported, `500` not |
| heartbeat | `GET /v1/heartbeat` | `2xx` supported, `404` not |
| allowlists | `GET /v1/allowlists` | not `404` supported |
| bulk allowlist check | `POST /v1/allowlists/check` `{"targets":[]}` | `400`/`2xx` supported, `404`/`405` not |
| `kind` filter | `GET /v1/alerts?kind=cscli&limit=1` | `2xx` supported, `500` not |

A `401` on any probe is inconclusive (the caller is not authenticated), and is
never read as proof that a route or filter exists; a `403` still proves the
route exists. This keeps an unauthenticated `detectCapability` call from marking
every endpoint as supported.

A watcher JWT cannot reach decision routes and a bouncer key cannot reach alert
routes, so each client probes its own set. A bouncer therefore cannot detect
`allowlists`, `kind` or `heartbeat`; with both credentials, declare
`lapiVersion` (the two clients do not share state).

The bouncer probes are selective because `/v1/decisions` has no `limit`: an
unfiltered probe would download the whole decision set twice. Do not use a short
timeout instead — it does not cancel the LAPI work and turns a slow deployment
into a false negative.

Before v1.6.9, `POST /v1/allowlists/check` answers `405` because it shares a
prefix with the single-value route.

## Fallback catalogue

| Capability | Fallback |
| --- | --- |
| `contains` | Only send it with `ip`/`range`, so plain listings work on 1.0.0. Writes deliberately fail on `<1.0.3` instead of widening the delete. |
| `kind` filter | Typed error, or drop the filter with an explicit warning. Never on delete. |
| allowlist pre-check (`ban_ip`) | On `404`/`405` or `FeatureNotSupportedError`, skip the pre-check and continue. Implemented in `ensureBanAllowed`. |
| bulk allowlist check | On `404`/`405`, iterate `GET /v1/allowlists/check/{value}`. Implemented in `Allowlists.bulkCheck`; the fallback only returns allowlisted targets and labels the allowlist name as `unknown allowlist (matched item: ...)` because the single-value route does not expose it. |
| decision `origins`/`scenarios_*` | Typed error, or query alerts instead. |
| `DELETE /decisions?scenario=` | Gate on 1.4.2, or search alerts then delete by id. |
| stream `scopes` | Typed error when the capability is known. No automatic restart: declare `lapiVersion` or omit `scopes` on old LAPIs. |
| `DELETE /alerts/{id}` | `404`/`405`: typed error when the capability is known (declared/probed), otherwise the raw HTTP error; `403`: error stating host-only. |
| `decision_type` on `DELETE /alerts` | On a `400`/`500` "unknown filter", the MCP searches alerts with `decision_type` then deletes by id. |
| alert `simulated` | On a `400`/`500` "unknown filter", the MCP retries the alert search without it (simulated decisions are omitted). Never dropped when the caller asked to exclude simulated decisions (`simulated: false`). |
| heartbeat | On `404`, disable the loop and log once. |
| `Decision.until` | Compute from `duration`. |

## Live validation

`.github/workflows/client-live-matrix.yml` runs
`packages/crowdsec-client/tests/Live/live.test.ts` against the supported tags in
Docker (`both`, `watcher`, `bouncer`, HTTP and TLS). The suite asserts detected
capabilities against each tag's minimum and exercises the gated methods.
Pull requests touching the client run a reduced matrix (oldest and latest tag,
`both` mode, HTTP only); the full matrix runs on demand via `workflow_dispatch`.
`packages/crowdsec-client` exposes it as `pnpm test:live:matrix`.

## JSDoc convention

A public method or option that depends on a LAPI capability documents its
minimum with `@since CrowdSec X.Y.Z`; use the runtime version from the matrix,
not the swagger version. Add `@remarks` when the capability is probed and
`@throws` when it can fail for a non-version reason.

## Known limitations

1. The instance `WatcherClient.deleteWatcher()` must be called after `login()`
   because `/v1/watchers/self` is JWT-only. The static
   `WatcherClient.deleteWatcher(options)` helper uses Basic Auth and therefore
   fails where the LAPI enforces JWT.
2. Route-`404` and object-`404` are only distinguishable by message.
3. `Alerts.delete({})` / `Decisions.delete({})` with an empty filter delete
   everything; the MCP guards `all=true`, the client methods do not.
