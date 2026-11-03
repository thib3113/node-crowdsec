# crowdsec-client

[![NPM version](https://img.shields.io/npm/v/crowdsec-client.svg)](https://www.npmjs.com/package/crowdsec-client)
[![CI](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml/badge.svg)](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml)
[![Downloads](https://img.shields.io/npm/dm/crowdsec-client.svg)](https://www.npmjs.com/package/crowdsec-client)
[![License](https://img.shields.io/npm/l/crowdsec-client)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/github/thib3113/node-crowdsec/badge.svg)](https://snyk.io/test/github/thib3113/node-crowdsec)
[![crowdsec-client-snyk](https://snyk.io/advisor/npm-package/crowdsec-client/badge.svg)](https://snyk.io/advisor/npm-package/crowdsec-client)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?logo=paypal)](https://paypal.me/thib3113)
[![GitHub stars](https://img.shields.io/github/stars/thib3113/node-crowdsec.svg?style=social&label=Star)](https://github.com/thib3113/node-crowdsec/stargazers/)
[![Package Quality](https://packagequality.com/shield/crowdsec-client.svg)](https://packagequality.com/#?package=crowdsec-client)

[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=bugs)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=code_smells)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=ncloc)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=alert_status)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=security_rating)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=sqale_index)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)

![Dependencies update - renovate](https://img.shields.io/badge/renovate-enabled-green?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjUgNSAzNzAgMzcwIj48Y2lyY2xlIGN4PSIxODkiIGN5PSIxOTAiIHI9IjE4NCIgZmlsbD0iI2ZlMiIvPjxwYXRoIGZpbGw9IiM4YmIiIGQ9Ik0yNTEgMjU2bC0zOC0zOGExNyAxNyAwIDAxMC0yNGw1Ni01NmMyLTIgMi02IDAtN2wtMjAtMjFhNSA1IDAgMDAtNyAwbC0xMyAxMi05LTggMTMtMTNhMTcgMTcgMCAwMTI0IDBsMjEgMjFjNyA3IDcgMTcgMCAyNGwtNTYgNTdhNSA1IDAgMDAwIDdsMzggMzh6Ii8+PHBhdGggZmlsbD0iI2Q1MSIgZD0iTTMwMCAyODhsLTggOGMtNCA0LTExIDQtMTYgMGwtNDYtNDZjLTUtNS01LTEyIDAtMTZsOC04YzQtNCAxMS00IDE1IDBsNDcgNDdjNCA0IDQgMTEgMCAxNXoiLz48cGF0aCBmaWxsPSIjYjMwIiBkPSJNMjg1IDI1OGw3IDdjNCA0IDQgMTEgMCAxNWwtOCA4Yy00IDQtMTEgNC0xNiAwbC02LTdjNCA1IDExIDUgMTUgMGw4LTdjNC01IDQtMTIgMC0xNnoiLz48cGF0aCBmaWxsPSIjYTMwIiBkPSJNMjkxIDI2NGw4IDhjNCA0IDQgMTEgMCAxNmwtOCA3Yy00IDUtMTEgNS0xNSAwbC05LThjNSA1IDEyIDUgMTYgMGw4LThjNC00IDQtMTEgMC0xNXoiLz48cGF0aCBmaWxsPSIjZTYyIiBkPSJNMjYwIDIzM2wtNC00Yy02LTYtMTctNi0yMyAwLTcgNy03IDE3IDAgMjRsNCA0Yy00LTUtNC0xMSAwLTE2bDgtOGM0LTQgMTEtNCAxNSAweiIvPjxwYXRoIGZpbGw9IiNiNDAiIGQ9Ik0yODQgMzA0Yy00IDAtOC0xLTExLTRsLTQ3LTQ3Yy02LTYtNi0xNiAwLTIybDgtOGM2LTYgMTYtNiAyMiAwbDQ3IDQ2YzYgNyA2IDE3IDAgMjNsLTggOGMtMyAzLTcgNC0xMSA0em0tMzktNzZjLTEgMC0zIDAtNCAybC04IDdjLTIgMy0yIDcgMCA5bDQ3IDQ3YTYgNiAwIDAwOSAwbDctOGMzLTIgMy02IDAtOWwtNDYtNDZjLTItMi0zLTItNS0yeiIvPjxwYXRoIGZpbGw9IiMxY2MiIGQ9Ik0xNTIgMTEzbDE4LTE4IDE4IDE4LTE4IDE4em0xLTM1bDE4LTE4IDE4IDE4LTE4IDE4em0tOTAgODlsMTgtMTggMTggMTgtMTggMTh6bTM1LTM2bDE4LTE4IDE4IDE4LTE4IDE4eiIvPjxwYXRoIGZpbGw9IiMxZGQiIGQ9Ik0xMzQgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em0tMzUgMzZsMTgtMTggMTggMTgtMTggMTh6Ii8+PHBhdGggZmlsbD0iIzJiYiIgZD0iTTExNiAxNDlsMTgtMTggMTggMTgtMTggMTh6bTU0LTU0bDE4LTE4IDE4IDE4LTE4IDE4em0tODkgOTBsMTgtMTggMTggMTgtMTggMTh6bTEzOS04NWwyMyAyM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTI0LTI0Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS01IDEyLTUgMTYgMHoiLz48cGF0aCBmaWxsPSIjM2VlIiBkPSJNMTM0IDk1bDE4LTE4IDE4IDE4LTE4IDE4em0tNTQgMThsMTgtMTcgMTggMTctMTggMTh6bTU1LTUzbDE4LTE4IDE4IDE4LTE4IDE4em05MyA0OGwtOC04Yy00LTUtMTEtNS0xNiAwTDEwMyAyMDFjLTQgNC00IDExIDAgMTVsOCA4Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS00IDEyLTQgMTYgMHoiLz48cGF0aCBmaWxsPSIjOWVlIiBkPSJNMjcgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em01NC01M2wxOC0xOCAxOCAxOC0xOCAxOHoiLz48cGF0aCBmaWxsPSIjMGFhIiBkPSJNMjMwIDExMGwxMyAxM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTEzLTEzYzQgNCAxMSA0IDE1IDBsMTAxLTEwMWM1LTUgNS0xMSAwLTE2eiIvPjxwYXRoIGZpbGw9IiMxYWIiIGQ9Ik0xMzQgMjQ4Yy00IDAtOC0yLTExLTVsLTIzLTIzYTE2IDE2IDAgMDEwLTIzTDIwMSA5NmExNiAxNiAwIDAxMjIgMGwyNCAyNGM2IDYgNiAxNiAwIDIyTDE0NiAyNDNjLTMgMy03IDUtMTIgNXptNzgtMTQ3bC00IDItMTAxIDEwMWE2IDYgMCAwMDAgOWwyMyAyM2E2IDYgMCAwMDkgMGwxMDEtMTAxYTYgNiAwIDAwMC05bC0yNC0yMy00LTJ6Ii8+PC9zdmc+
)

[![NPM](https://nodei.co/npm/crowdsec-client.png)](https://nodei.co/npm/crowdsec-client/)

This library is a Node.js client for the CrowdSec REST API.

> **For LLMs:** give your agent
> <https://raw.githubusercontent.com/thib3113/node-crowdsec/main/llms.txt>.

## Start

install it

```
npm i crowdsec-client
```

and then read the [getting started guide](https://github.com/thib3113/node-crowdsec/wiki/Getting-Started) or the [API reference](https://thib3113.github.io/node-crowdsec/).

## CrowdSec compatibility

The client works with CrowdSec LAPI `v1.0.0` and newer; features added in later
releases are unavailable on older servers.

| Feature | Minimum LAPI |
| --- | --- |
| Bouncer (decisions, decisions stream) | 1.0.0 |
| Watcher (alerts) | 1.0.0 |
| `contains` filter | 1.0.3 |
| Heartbeat | 1.4.0 |
| `DELETE /alerts/{id}`, `DELETE /decisions?scenario=` | 1.4.2 |
| Allowlists (list, get, check) | 1.6.6 |
| Bulk allowlist check, watcher self-delete | 1.6.9 |
| `kind` alert filter | 1.7.7 |

See [`docs/api-compatibility.md`](../../docs/api-compatibility.md) for the full
matrix, failure modes, probes and fallbacks.

### Capability detection

Declare `lapiVersion` to resolve capabilities without a request, or set
`detectCapabilities: true` to probe after login. Results are memoised per
instance; methods that need a newer LAPI throw `FeatureNotSupportedError`, and
`strictCapabilities` also rejects unverifiable capabilities.

```ts
const watcher = new WatcherClient({ url, auth, detectCapabilities: true });
await watcher.login();
watcher.supports('allowlists'); // true | false | undefined
watcher.getProbableVersion(); // { probable: '>=1.6.9 <1.7.7' }
```

Two caveats: `DELETE /alerts/{id}` and `DELETE /decisions?scenario=` (1.4.2)
cannot be probed without sending a `DELETE`, so they stay `undefined`; and a
decision created on an old or remote LAPI may not be deletable (alert deletion
is LAPI-host-only). Prefer short durations or delete by decision id.

## Usage

### Quick start

```ts
import { BouncerClient, WatcherClient } from 'crowdsec-client';

const bouncer = new BouncerClient({
    url: process.env.CROWDSEC_URL!,
    auth: { apiKey: process.env.CROWDSEC_API_KEY! }
});
await bouncer.login();
const { new: newDecisions } = await bouncer.Decisions.getRawStream({ startup: true });

const watcher = new WatcherClient({
    url: process.env.CROWDSEC_URL!,
    auth: {
        machineID: process.env.CROWDSEC_MACHINE_ID!,
        password: process.env.CROWDSEC_PASSWORD!,
        autoRenew: true
    },
    heartbeat: false
});
await watcher.login();
const alerts = await watcher.Alerts.search({ has_active_decision: true, limit: 10 });
```

Stream filters, alert management and all authentication modes (TLS, mTLS) are
documented in the [getting started guide](https://github.com/thib3113/node-crowdsec/wiki/Getting-Started)
and [Authentications](https://github.com/thib3113/node-crowdsec/wiki/Authentications).

## Type overrides

The generated API types under `src/types/generated` come from the upstream
CrowdSec swagger and are never edited by hand. Known discrepancies with the
actual LAPI are typed in `src/types/overrides.ts` and exported as
`SearchAlertsQuery` / `DeleteAlertsQuery` / `DeleteDecisionsQuery` (also
available as `APITypes.SearchAlertsQuery` / `APITypes.DeleteAlertsQuery` /
`APITypes.DeleteDecisionsQuery`):

- `since` and `until` are Go durations (`24h`, `7d`) on both alert search and
  alert delete, despite the swagger documenting them as timestamps for delete.
- `contains` and `kind` are supported by the alert filters but missing from the
  generated search type; `decision_type` is also missing from the delete type.
- Alert delete accepts `origin` (decision origin), not `alert_source` (rejected
  by LAPI 1.8.1). `kind`, `contains` and `decision_type` are accepted too.
- Decision delete uses `scope` before LAPI 1.3.3 and `scopes` from 1.3.3.
  `Decisions.delete()` uses the `decisionScopesDelete` capability when known;
  otherwise it tries `scopes`, falls back to `scope` on the specific
  `500 invalid filter`, and caches the learned value. At the LAPI level
  `contains` defaults to true; `Alerts.delete()` and `Decisions.delete()` make
  it explicit (`contains: false`) whenever `ip` or `range` is present, so an
  IP delete does not also expire Range decisions that contain it. Pass
  `contains: true` to opt into the wider behaviour.
- Decision search accepts `simulated`. The LAPI excludes simulated decisions by
  default and does not return the `simulated` field on `/v1/decisions`; pass
  `simulated: true` to include them. `Decision.simulated` is therefore
  `boolean | undefined` in 1.4.0: `undefined` means the connected LAPI omitted
  the field, not `false`.

These behaviours were validated against `crowdsec:v1.8.1` in Docker.

Run `pnpm run generate-api` to refresh the generated files, then re-check the
overrides against the new schema.

## Debug

this library include [debug](https://www.npmjs.com/package/debug), to debug, you can set the env variable :

````dotenv
DEBUG=crowdsec-client:*
````

## License

MIT
