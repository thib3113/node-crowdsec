# Architecture and security assessment

This document describes the components, actors and data flows of the project,
and summarises the security assessment used to prioritise mitigations. It is
reviewed whenever a package, tool or external interface is added.

## Components

| Package | Responsibility |
| --- | --- |
| `crowdsec-client` | CrowdSec Local API (LAPI) client: bouncer endpoints (`/v1/decisions`) and watcher endpoints (`/v1/alerts`, `/v1/allowlists`). |
| `crowdsec-http-middleware` | HTTP middleware that queries or caches decisions and blocks or flags requests; includes scenarios and the `IpDecisionDB` store. |
| `crowdsec-client-scenarios` | Detection scenarios (for example the `X-Forwarded-For` checker) built on the middleware. |
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

1. The operator configures a bouncer or watcher credential.
2. `crowdsec-client` authenticates to the LAPI over HTTPS and fetches decisions
   (bouncer) or alerts and allowlists (watcher).
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
| CrowdSec API keys | Leakage through logs, errors or the repository | Credentials are read from the environment or configuration only, redacted from MCP tool output and errors, and the repository has secret scanning and push protection enabled |
| Decisions and allowlists | Poisoned or unauthorised writes | Read-only by default; write tools are opt-in per tool; destructive tools require an additional flag and, over HTTP, a service token; bans pre-check allowlists and are capped by a maximum duration |
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
- The MCP server inherits the privileges of the credentials it is given.
- Denial of service against an application remains possible if the middleware
  is exposed without rate limiting or a reverse proxy.
- The security assessment is revisited when a new package, tool or external
  interface is introduced.
