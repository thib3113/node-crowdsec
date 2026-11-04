# Architecture and security assessment

This document describes the components, actors and data flows of the project,
and summarises the security assessment used to prioritise mitigations. It is
reviewed whenever a package, tool or external interface is added.

## Components

| Package | Responsibility |
| --- | --- |
| `crowdsec-client` | CrowdSec Local API (LAPI) client: bouncer endpoints (`/v1/decisions`) and watcher endpoints (`/v1/alerts`, `/v1/allowlists`), with version capability detection and typed `FeatureNotSupportedError` guards. |
| `crowdsec-http-middleware` | HTTP middleware that queries or caches decisions and exposes the decision on the request (the application blocks or flags it); includes the `IpDecisionDB` store and the watcher middleware that runs scenarios. |
| `crowdsec-client-scenarios` | Detection and IP-extraction scenarios (for example the `X-Forwarded-For` checker) consumed by the watcher middleware or standalone. |
| `crowdsec-mcp` | Model Context Protocol server exposing alerts, decisions and allowlists to MCP clients over stdio or HTTP. |

## Actors

| Actor | Description |
| --- | --- |
| Operator | Runs the application, configures credentials and policy. |
| Application / HTTP client | Sends requests through the middleware or calls the bouncer client. |
| CrowdSec LAPI | Authoritative source of decisions and alerts. |
| MCP client (agent or LLM) | Calls MCP tools and reads MCP resources through stdio or HTTP. |
| Maintainer / CI | Builds, tests and publishes packages and container images. |

## Actions and data flows

1. The operator configures a bouncer API key and/or watcher credentials. The
   MCP server may use both at once: the bouncer key serves the fast
   `/v1/decisions` path, the watcher serves alerts, allowlists and writes.
2. `crowdsec-client` authenticates to the LAPI over HTTPS and fetches decisions
   (bouncer) or alerts and allowlists (watcher). Capabilities are resolved from
   a declared `lapiVersion`, optional post-login probes, or lazily; unsupported
   features raise a typed error instead of being silently ignored.
3. The middleware answers each request from its in-memory decision store
   (`IpDecisionDB`), with an optional live mode that queries the LAPI.
4. Scenarios inspect request metadata (headers, client IP) to detect abuse.
5. `crowdsec-mcp` exposes read tools (alerts, decisions, allowlists) to an MCP
   client; write tools (ban, unban, delete) are disabled unless explicitly
   enabled by the operator.
6. CI builds and tests every package; the release workflow publishes npm
   packages and container images with signatures and provenance.

## External interfaces

- CrowdSec LAPI HTTP API (`/v1/decisions`, `/v1/alerts`, `/v1/allowlists`).
- Public npm package APIs, documented with Typedoc and per-package READMEs.
- MCP tools and resources over stdio or HTTP, with Zod-validated inputs.
- Container images and the Docker Compose deployment.

## Security assessment (threat model)

| Asset | Threat | Mitigation |
| --- | --- | --- |
| CrowdSec API keys | Leakage through logs, errors or the repository | Credentials are read from the environment, a `_FILE` secret or configuration only, redacted from MCP tool output and errors, and the repository has secret scanning and push protection enabled |
| Version mismatch | A request the connected LAPI does not understand is silently widened or fails with a raw 500 | Capabilities are declared or probed; gated methods raise `FeatureNotSupportedError`, and `docs/api-compatibility.md` records the fallbacks |
| Passthrough credentials | A reverse proxy injects a privileged identity and a caller adds its own header, gaining the union | Passthrough trusts every `X-CrowdSec-*` header it receives and cannot tell a proxy-injected header from a caller-supplied one; operators must strip incoming `X-CrowdSec-*` at the proxy (see "Passthrough credentials" in the MCP README) |
| Decisions and allowlists | Poisoned or unauthorised writes | Read-only by default; write tools require `CROWDSEC_MCP_READONLY=false`; `delete_alerts` additionally requires `CROWDSEC_MCP_ENABLE_ALERT_DELETE=true` and, over HTTP, a service token unless explicitly overridden; bans pre-check allowlists and are capped by a maximum duration |
| Client IP determination | Spoofing through `X-Forwarded-For` | Only configured `trustedProxies` are honoured, with normalisation of IPv4-mapped (`::ffff:`) addresses |
| Transport | Man-in-the-middle or tampering | HTTPS with certificate verification enabled by default |
| Release artifacts | Supply-chain tampering | CI-only publishing, npm provenance, cosign signatures and SLSA provenance on releases, least-privilege workflow tokens, pinned actions and a digest-pinned base image |
| Availability | Large decision sets or slow LAPI responses | Indexed decision lookup avoids per-decision scans, and client timeouts bound slow calls |

## Attack surface and critical paths

The attack surface is limited to:

- the CrowdSec LAPI responses consumed by `crowdsec-client`;
- request metadata read by the middleware and scenarios (headers, client IP);
- MCP tool inputs over stdio or HTTP;
- the release pipeline and the credentials it uses.

The critical code paths are credential handling, decision lookup
(`IpDecisionDB`), trusted-proxy and `X-Forwarded-For` parsing, MCP tool argument
validation, and write operations (ban, unban, delete). These paths receive the
strictest review and are covered by tests.

This threat model is reviewed whenever a package, tool or external interface is
added, and at least once per release.

## Residual risks and assumptions

- The LAPI and its credentials are trusted; a compromised LAPI can return
  arbitrary decisions.
- The MCP server inherits the privileges of the credentials it is given. When
  both credentials are configured, it holds the union of their rights.
- Capability state is per client instance: a watcher and a bouncer configured
  together do not share what they detected, so the estimated version is coarser
  unless `lapiVersion` is declared.
- Denial of service against an application remains possible if the middleware
  is exposed without rate limiting or a reverse proxy.
- The security assessment is revisited when a new package, tool or external
  interface is introduced.
