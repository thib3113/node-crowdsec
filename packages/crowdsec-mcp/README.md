# crowdsec-mcp

[![CI](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml/badge.svg)](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml)
[![codecov](https://codecov.io/gh/thib3113/node-crowdsec/branch/main/graph/badge.svg?token=bQdlb31gcU)](https://codecov.io/gh/thib3113/node-crowdsec)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/github/thib3113/node-crowdsec/badge.svg)](https://snyk.io/test/github/thib3113/node-crowdsec)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?logo=paypal)](https://paypal.me/thib3113)
[![GitHub stars](https://img.shields.io/github/stars/thib3113/node-crowdsec.svg?style=social&label=Star)](https://github.com/thib3113/node-crowdsec/stargazers/)

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

**Give this to your AI agent.** Copy/paste this prompt:

> Read <https://raw.githubusercontent.com/thib3113/node-crowdsec/main/packages/crowdsec-mcp/README.md> and give me a brief of what the MCP can do, then explain how to install and configure it for my client (Claude Desktop/Code, Cursor or opencode). Never ask me for credentials: just tell me which environment variables to set. Also explain the security impact before enabling `ban_ip`, `unban_ip` or `delete_alerts`.

The agent can use this document as the installation and configuration reference.

A [Model Context Protocol](https://modelcontextprotocol.io) server for CrowdSec. It exposes decisions, alerts and allowlists to an LLM as readable Markdown, with guarded write operations for watcher credentials.

- `npx`-friendly, stdio by default
- Bouncer API key, watcher machine credentials, or mutual TLS
- Read-only by default
- Optional Streamable HTTP transport with a mandatory bearer token
- Server-side tool filtering
- cscli-compatible behavior for decisions, alerts and allowlists

## Requirements

- Node.js 24 or newer.
- A reachable CrowdSec Local API (LAPI).

## Quick start

```bash
npx -y crowdsec-mcp
```

From a checkout, before the npm release or for development:

```bash
pnpm --filter crowdsec-mcp build
node packages/crowdsec-mcp/dist/index.js
```

With a bouncer API key:

```bash
CROWDSEC_URL=https://crowdsec:8080 \
CROWDSEC_API_KEY=your-bouncer-key \
npx -y crowdsec-mcp
```

With a watcher (required for alerts, allowlists and write tools):

```bash
CROWDSEC_URL=https://crowdsec:8080 \
CROWDSEC_MACHINE_ID=crowdsec-mcp \
CROWDSEC_PASSWORD=your-password \
npx -y crowdsec-mcp
```

## Authentication

The authentication mode is auto-detected from the provided credentials, or can be forced with `CROWDSEC_AUTH=bouncer|watcher`.

| Mode | Credentials | Capabilities |
| --- | --- | --- |
| `bouncer` | `CROWDSEC_API_KEY` | read decisions |
| `watcher` | `CROWDSEC_MACHINE_ID` + `CROWDSEC_PASSWORD` | alerts, decisions, allowlists, writes |
| either | `CROWDSEC_TLS_CERT` + `CROWDSEC_TLS_KEY` + `CROWDSEC_TLS_CA` | mutual TLS |

All three TLS files are required together. Use `CROWDSEC_STRICT_SSL=false` only for self-signed certificates in development.

With mutual TLS and no explicit `CROWDSEC_AUTH`, the server defaults to `watcher` (agent certificate). Set `CROWDSEC_AUTH=bouncer` when the certificate belongs to a bouncer.

If both a bouncer key and machine credentials are present, set `CROWDSEC_AUTH` explicitly. Without it, the bouncer API key takes precedence.

### Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `CROWDSEC_URL` | CrowdSec LAPI URL | required |
| `CROWDSEC_AUTH` | `bouncer` or `watcher` | auto |
| `CROWDSEC_API_KEY` | Bouncer API key | - |
| `CROWDSEC_MACHINE_ID` | Watcher machine ID | - |
| `CROWDSEC_PASSWORD` | Watcher password | - |
| `CROWDSEC_TLS_CERT` | Client certificate path | - |
| `CROWDSEC_TLS_KEY` | Client key path | - |
| `CROWDSEC_TLS_CA` | CA certificate path | - |
| `CROWDSEC_STRICT_SSL` | Validate TLS certificates | `true` |
| `CROWDSEC_TIMEOUT` | HTTP timeout in milliseconds | `10000` |
| `CROWDSEC_MCP_TRANSPORT` | `stdio` or `http` | `stdio` |
| `CROWDSEC_MCP_PASSTHROUGH` | Use per-request LAPI credentials (HTTP only) | `false` |
| `CROWDSEC_MCP_HTTP_HOST` | HTTP bind host | `127.0.0.1` |
| `CROWDSEC_MCP_HTTP_PORT` | HTTP bind port | `3939` |
| `CROWDSEC_MCP_HTTP_TOKEN` | HTTP bearer token | required for HTTP; optional in passthrough |
| `CROWDSEC_MCP_READONLY` | Hide write tools | `true` |
| `CROWDSEC_MCP_ENABLE_ALERT_DELETE` | Expose `delete_alerts` (requires the MCP next to the LAPI) | `false` |
| `CROWDSEC_MCP_ALLOW_ALERT_DELETE_WITHOUT_TOKEN` | Allow `delete_alerts` over HTTP without a service token (dangerous) | `false` |
| `CROWDSEC_MCP_TOOLS` | Comma-separated allowlist of tools | all |
| `CROWDSEC_MCP_DISABLE_TOOLS` | Comma-separated denylist of tools | none |
| `CROWDSEC_MCP_MAX_RESULTS` | Default result limit | `25` |
| `CROWDSEC_MCP_MAX_BAN_DURATION` | Maximum ban duration without `force` | `24h` |

Secrets should stay in the environment. Command-line arguments are available for convenience, but are visible in the process list.

### CLI arguments

Most environment variables above have a kebab-case argument equivalent: `--url`, `--auth`, `--api-key`, `--machine-id`, `--password`, `--tls-cert`, `--tls-key`, `--tls-ca`, `--timeout`, `--transport`, `--http-host`, `--http-port`, `--http-token`, `--passthrough`, `--enable-alert-delete`, `--allow-alert-delete-without-token`, `--tools`, `--disable-tools`, `--max-results`, `--max-ban-duration`. Exceptions: `CROWDSEC_STRICT_SSL` uses `--insecure`, and `CROWDSEC_MCP_READONLY` uses `--readonly`/`--write`.

Use `--help` for the full list.

## Tools

Read-only tools are always available according to the authentication mode. Write tools are hidden by default and require `CROWDSEC_MCP_READONLY=false`.

| Tool | Kind | Auth | Description |
| --- | --- | --- | --- |
| `crowdsec_status` | read | any | Connection status, auth mode, capabilities and active tools |
| `list_decisions` | read | bouncer, watcher | Active decisions, like `cscli decisions list` |
| `get_decision` | read | watcher | Get an active decision by ID, with alert context |
| `list_alerts` | read | watcher | Alerts with filters, like `cscli alerts list` |
| `get_alert` | read | watcher | Alert details, decisions, meta and events |
| `list_allowlists` | read | watcher | Allowlists and their size |
| `get_allowlist` | read | watcher | Allowlist details and items |
| `check_allowlist` | read | watcher | Check one or many IPs/ranges against allowlists |
| `ban_ip` | write | watcher | Add a decision via the cscli alert payload |
| `unban_ip` | write | watcher | Delete decisions by ID, filters, or all with confirmation |
| `delete_alerts` | write | watcher | Opt-in; delete alerts by ID, filters, or all with confirmation (local deployment only) |

### Read-only by default

```bash
CROWDSEC_MCP_READONLY=true   # default: write tools are not registered
CROWDSEC_MCP_READONLY=false  # expose write tools
```

When read-only is enabled, write tools are not advertised at all: the model cannot call them.

`list_alerts` reports active decisions only in its Decisions column. `list_decisions`, `get_decision` and `get_alert` expose the decision ID and a computed expiry (from the remaining decision duration).

When `limit` is explicit, the MCP fetches all matching rows so the `hidden` count is exact. Without an explicit `limit`, it fetches `CROWDSEC_MCP_MAX_RESULTS` rows and only hints that more may exist. This keeps default calls cheap on large alert datasets.

### Limit the tools exposed to the model

```bash
# Only these tools are registered
CROWDSEC_MCP_TOOLS=crowdsec_status,list_decisions,list_alerts

# Hide specific tools
CROWDSEC_MCP_DISABLE_TOOLS=delete_alerts,ban_ip
```

The allowlist wins over the denylist, and read-only mode always wins over both. Unknown names in `CROWDSEC_MCP_TOOLS` make the server fail at startup, so typos are visible immediately.

## Documentation for the model

The server ships its own CrowdSec documentation, so an agent can work without prior knowledge of the product:

- **Server instructions** are sent at initialization. They carry the current authentication mode, write access, limits, availability of alerts/allowlists/alert deletion, and the working rules (investigate before acting, confirm before writing, never invent IDs).
- **Resources** can be read on demand:
    - `crowdsec://docs/overview`: components, detection lifecycle, and what this MCP exposes.
    - `crowdsec://docs/concepts`: alert vs decision, scopes, types, durations, origins, allowlists, bouncer vs watcher.
    - `crowdsec://docs/triage`: alert to decision workflow with guardrails and `cscli` equivalents.
- **Prompts** provide ready-made workflows:
    - `triage_alerts`: review recent alerts, correlate them with active decisions, propose or apply remediation.
    - `investigate_ip`: summarise the detection history and remediation state of one IP.
    - `banned_from_country`: list the IPs with an active decision that are geolocated in a given country. The LAPI alert search has no country filter, so the selection is done on the alert `Country` column, filled by MaxMind enrichment.

The content adapts to the configuration: a bouncer only gets `investigate_ip` (the other prompts need alerts), and a read-only server gets analysis-only prompts.

### Upstream CrowdSec documentation

| Topic | Link |
| --- | --- |
| Introduction | <https://docs.crowdsec.net/docs/intro/> |
| Concepts | <https://docs.crowdsec.net/docs/concepts/> |
| Local API | <https://docs.crowdsec.net/docs/local_api/intro/> |
| Remediation components (bouncers) | <https://docs.crowdsec.net/u/bouncers/intro/> |
| Scenarios | <https://docs.crowdsec.net/docs/log_processor/scenarios/intro/> |
| Central API and community blocklist | <https://docs.crowdsec.net/docs/central_api/community_blocklist/> |
| Centralized allowlists | <https://docs.crowdsec.net/docs/local_api/centralized_allowlists/> |
| `cscli alerts` | <https://docs.crowdsec.net/docs/cscli/cscli_alerts/> |
| `cscli decisions` | <https://docs.crowdsec.net/docs/cscli/cscli_decisions/> |
| `cscli allowlists` | <https://docs.crowdsec.net/docs/cscli/cscli_allowlists/> |

## Write operations

### `ban_ip`

Mirrors `cscli decisions add`:

```text
ban_ip(ip="203.0.113.10", duration="4h", type="ban", reason="manual block")
ban_ip(range="203.0.113.0/24", duration="1h", type="captcha")
```

- Provide exactly one of `ip`, `range`, or `scope` + `value`; mixing them is rejected.
- IP and CIDR inputs are validated before sending anything. Scopes and decision types are validated too.
- The value is checked against allowlists first. If it is allowlisted, the call is refused unless `force=true`.
- `duration` accepts a unit (`30m`, `4h`, `7d`, `1h30m`). A bare number is interpreted as seconds (`300` = `5m`).
- `Country` values must be two-letter codes; `AS` values must be numeric ASNs. `Ip`/`Range` values are validated as IP/CIDR.
- `duration` is limited by `CROWDSEC_MCP_MAX_BAN_DURATION` unless `force=true`.
- CrowdSec accepts private, unspecified (`0.0.0.0`), broadcast and TEST-NET addresses; the MCP does not filter them.
- The decision is created through `POST /v1/alerts`, exactly like cscli. It is therefore visible as an alert, and may be forwarded to CAPI depending on your CrowdSec configuration.
- `origin` is always `cscli`; the MCP does not impersonate a scenario.

### `unban_ip`

`unban_ip` deletes decisions and works from anywhere:

```text
unban_ip(ip="203.0.113.10")
unban_ip(id="42")
unban_ip(all=true, confirm=true)
```

`all=true` without `confirm=true` is rejected. `scope` must be combined with `value` (`unban_ip(scope="Country", value="FR")`); `scope` alone is rejected so a broad filter cannot delete every decision of that scope. `range` containment is resolved through an alert search and deleted by ID; other scopes are sent directly to the LAPI. `type`/`scenario` alone are broad and also require `confirm=true`; narrow with `ip`, `range`, or `scope`+`value`.

### `delete_alerts` (opt-in)

`delete_alerts` is disabled by default because CrowdSec only allows alert deletion from the LAPI host. Enable it only when the MCP runs next to the LAPI:

```bash
CROWDSEC_MCP_ENABLE_ALERT_DELETE=true
```

A remote watcher receives `403 access forbidden from this IP`. Use `unban_ip` to remove decisions remotely, and `cscli alerts delete` on the LAPI host to clean up alerts.

Over HTTP, `delete_alerts` is hidden unless a service token (`CROWDSEC_MCP_HTTP_TOKEN`) is configured or `CROWDSEC_MCP_ALLOW_ALERT_DELETE_WITHOUT_TOKEN=true` is set. This prevents a tokenless shared MCP (for example in passthrough mode) from exposing the local-only destructive path. Over stdio, the process is already local, so only `CROWDSEC_MCP_ENABLE_ALERT_DELETE` is required.

`all=true` cannot be combined with filters. `ip` and `range` accept a CIDR and perform containment. `type` is resolved through an alert search followed by deletion by ID, as the conservative path for LAPIs that do not accept `decision_type` on DELETE. `since` and `until` are Go durations (`24h`, `7d`) and are sent directly to the delete endpoint, like the alert search. `id`, `origin` (sent as `alert_source`) and `has_active_decision` are sent directly. `scope` must be combined with `value`; scope alone is rejected to avoid deleting every alert of that scope. Deleting without a narrow target (`id`, `ip`, `range`, or `scope`+`value`) — e.g. `scenario`, `origin`, `type`, `since`/`until` or `has_active_decision` alone — requires `confirm=true`, like `unban_ip`. Deleting an alert also deletes its active decisions; this cascade is a CrowdSec LAPI behavior.

### CIDR semantics

- `list_decisions(ip="198.51.100.0/24")` performs containment (`contains=false`, the default). `contains=true` returns decisions that contain the value.
- `list_alerts`, `delete_alerts` and `unban_ip` accept a CIDR in `ip`/`range` and perform containment.
- `delete_alerts` deletes matching alerts by ID when containment is used.
- `unban_ip` supports non-IP scopes (`Country`, `AS`, `Session`, `Username`) by resolving active decisions and deleting them by ID.

## Allowlists

Allowlists are read/check only. The CrowdSec local API exposes no create, update or delete endpoint for allowlists: those operations are done with `cscli allowlists ...` or the CrowdSec Console. The MCP therefore provides:

- `list_allowlists`
- `get_allowlist`
- `check_allowlist`

`ban_ip` automatically calls `check_allowlist` for IP and range scopes, like cscli. `check_allowlist` accepts IPs and CIDR ranges only; the LAPI bulk check endpoint does not support other scopes. When the target is a CIDR, a match means the CIDR overlaps or contains an allowlisted entry; the output labels it as a CIDR match rather than an exact IP match.

## MCP client configuration

### Claude Desktop / Claude Code

```json
{
    "mcpServers": {
        "crowdsec": {
            "command": "npx",
            "args": ["-y", "crowdsec-mcp"],
            "env": {
                "CROWDSEC_URL": "https://crowdsec:8080",
                "CROWDSEC_MACHINE_ID": "crowdsec-mcp",
                "CROWDSEC_PASSWORD": "change-me",
                "CROWDSEC_MCP_READONLY": "true"
            }
        }
    }
}
```

### Cursor

```json
{
    "mcpServers": {
        "crowdsec": {
            "command": "npx",
            "args": ["-y", "crowdsec-mcp"],
            "env": {
                "CROWDSEC_URL": "https://crowdsec:8080",
                "CROWDSEC_API_KEY": "your-bouncer-key",
                "CROWDSEC_MCP_TOOLS": "crowdsec_status,list_decisions"
            }
        }
    }
}
```

### opencode

```json
{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
        "crowdsec": {
            "type": "local",
            "command": ["npx", "-y", "crowdsec-mcp"],
            "environment": {
                "CROWDSEC_URL": "https://crowdsec:8080",
                "CROWDSEC_API_KEY": "your-bouncer-key"
            },
            "enabled": true
        }
    }
}
```

## HTTP transport

```bash
CROWDSEC_MCP_TRANSPORT=http \
CROWDSEC_MCP_HTTP_HOST=127.0.0.1 \
CROWDSEC_MCP_HTTP_PORT=3939 \
CROWDSEC_MCP_HTTP_TOKEN=change-me \
CROWDSEC_URL=https://crowdsec:8080 \
CROWDSEC_API_KEY=your-bouncer-key \
npx -y crowdsec-mcp
```

The token is **mandatory for every request**, including on `127.0.0.1` and including unknown routes. Send it as:

```text
Authorization: Bearer change-me
```

The MCP endpoint is `/mcp`. Do not expose this server publicly without TLS and a strong token: it can read security data and, when writes are enabled, ban or unban addresses.

### Shared deployment next to CrowdSec

A common setup is one MCP server next to the LAPI, with remote clients connecting over HTTP:

```bash
CROWDSEC_URL=http://127.0.0.1:8080 \
CROWDSEC_MACHINE_ID=crowdsec-mcp \
CROWDSEC_PASSWORD=change-me \
CROWDSEC_MCP_TRANSPORT=http \
CROWDSEC_MCP_HTTP_HOST=0.0.0.0 \
CROWDSEC_MCP_HTTP_TOKEN=change-me \
CROWDSEC_MCP_READONLY=false \
CROWDSEC_MCP_ENABLE_ALERT_DELETE=true \
npx -y crowdsec-mcp
```

Clients point their MCP client at `https://mcp.example.com/mcp` and send:

```text
Authorization: Bearer change-me
```

The MCP holds the LAPI credentials; users only need the MCP token. Put TLS and a reverse proxy in front, and use one token per MCP instance. This deployment allows `delete_alerts` because the LAPI sees the MCP as local.

### Per-user passthrough (multi-user)

For multiple users with individual LAPI credentials, enable passthrough:

```bash
CROWDSEC_URL=http://127.0.0.1:8080 \
CROWDSEC_MCP_TRANSPORT=http \
CROWDSEC_MCP_HTTP_HOST=0.0.0.0 \
CROWDSEC_MCP_PASSTHROUGH=true \
CROWDSEC_MCP_READONLY=false \
# Optional service gate:
# CROWDSEC_MCP_HTTP_TOKEN=change-me \
npx -y crowdsec-mcp
```

Each request provides exactly one LAPI credential:

```text
X-CrowdSec-Api-Key: <bouncer API key>     # read decisions only
# OR
X-CrowdSec-Token: <watcher JWT>           # full watcher tools / writes
```

If `CROWDSEC_MCP_HTTP_TOKEN` is configured, every request must also send:

```text
Authorization: Bearer <CROWDSEC_MCP_HTTP_TOKEN>
```

Rules:
- Both `X-CrowdSec-Api-Key` and `X-CrowdSec-Token` -> `400`.
- Neither -> `401`.
- Bouncer keys expose only bouncer-compatible tools; watcher JWTs expose the watcher toolset.
- Clients are created per request and never reuse another user's credential.
- The watcher JWT must be refreshed by the user when it expires.

**Why two tokens?** The optional service token gates the MCP endpoint itself, while the LAPI credential authorizes the actual CrowdSec action. The service token is optional because the LAPI credential already authenticates the request, but it is recommended when exposing the MCP: it prevents anonymous probing and gates the local-only `delete_alerts`. Without a service token, `delete_alerts` is hidden unless `CROWDSEC_MCP_ALLOW_ALERT_DELETE_WITHOUT_TOKEN=true` is set.

## Security

The MCP speaks to CrowdSec with real LAPI credentials. The security posture
depends on two choices: the transport (`stdio` vs `http`) and where the
credentials live (server environment vs per-request headers).

### Threat model

- **stdio**: the MCP is a local process started by the client. Nothing listens
  on the network. The main risk is who can read the client config or the
  process environment.
- **http**: the MCP listens on `CROWDSEC_MCP_HTTP_HOST:PORT` and only serves
  `POST /mcp` (anything else is 404/405). It runs stateless: one fresh
  server and transport per request, no session stored. Bodies are capped at
  4 MiB (413 beyond that) and server errors are returned as generic JSON-RPC
  messages without stack traces. There is **no TLS on the MCP port itself**:
  the bearer token and any passthrough credentials travel in cleartext. In
  practice the server is reachable from the network (e.g. a management VLAN
  for the AI agents), so put a TLS reverse proxy in front and restrict at
  the firewall who can reach the port.
- Credentials (API key, password, token, TLS material) are kept in process
  memory and never written to logs or tool outputs. Tool errors surfaced to
  the model are truncated to their first line.

### Recommended deployments

| Deployment | Access control | LAPI identity | Notes |
| --- | --- | --- | --- |
| stdio, local client | OS user boundary | server env (`CROWDSEC_API_KEY` or machine credentials) | Default. Nothing exposed on the network. |
| http on `127.0.0.1` + service token | `Authorization: Bearer` per request | server env, shared by all callers | Token is mandatory at startup outside passthrough. Local-only setups. |
| http on a management VLAN + TLS reverse proxy + service token | proxy + service token, firewall-limited to the VLAN | server env, shared by all callers | The realistic production setup. Rotate the token if it leaks: every holder shares the same LAPI identity. |
| http passthrough + service token | service token + per-request LAPI credential | per request (`X-CrowdSec-Api-Key` or `X-CrowdSec-Token`) | Multi-user friendly: each caller only gets their own LAPI rights. |
| http passthrough, no service token | per-request LAPI credential only | per request | Acceptable on a trusted management VLAN; anyone with a valid LAPI credential can probe the endpoint. |

In passthrough mode, `X-CrowdSec-Api-Key` (bouncer, read decisions only) and
`X-CrowdSec-Token` (watcher JWT, full toolset) are mutually exclusive:
sending both is a 400, sending neither is a 401. Requests headers are
validated and then discarded; one request never reuses another's credential.
The passthrough mode ignores `CROWDSEC_TLS_*`: mTLS client certificates are
not applied per request.

### Security-relevant variables

| Variable | Effect | Safe values |
| --- | --- | --- |
| `CROWDSEC_MCP_HTTP_HOST` | Network interface the MCP binds to. `0.0.0.0` exposes it to the LAN/container network. | `127.0.0.1` for local-only setups; otherwise bind behind a TLS reverse proxy on a management VLAN and firewall the port. |
| `CROWDSEC_MCP_HTTP_TOKEN` | Bearer token required on every request (compared in constant time). Mandatory in non-passthrough HTTP: the server refuses to start without it. | A long random value, rotated like a password. One token per MCP instance. |
| `CROWDSEC_MCP_READONLY` | `true` hides `ban_ip`, `unban_ip` and `delete_alerts` from `listTools`: the model cannot call what it cannot see. | Keep `true` (the default) unless writes are needed. |
| `CROWDSEC_MCP_ENABLE_ALERT_DELETE` | Exposes `delete_alerts`. Deletion only works from the LAPI host (403 otherwise). | `true` only in a sidecar/host deployment next to the LAPI. |
| `CROWDSEC_MCP_ALLOW_ALERT_DELETE_WITHOUT_TOKEN` | Forces `delete_alerts` to be exposed over HTTP **without** a service token. | Leave `false`. With this flag, anyone holding a watcher JWT can trigger local-only destructive deletions as soon as the port is reachable. |
| `CROWDSEC_MCP_TOOLS` / `CROWDSEC_MCP_DISABLE_TOOLS` | Allowlist/denylist of exposed tools. | Expose the smallest useful surface, e.g. `CROWDSEC_MCP_DISABLE_TOOLS=delete_alerts,ban_ip`. |
| `CROWDSEC_MCP_MAX_BAN_DURATION` | Bans above this need `force=true`. | `24h` default; tighten for shared deployments. |
| `CROWDSEC_STRICT_SSL` / `--insecure` | Disabling TLS validation between the MCP and the LAPI exposes credentials to MITM. | Keep `true`. Only disable for self-signed certificates in development. |

Keep secrets in the environment, not in command-line arguments: arguments are
visible in the process list.

### Confirmations are not authorization

Destructive tools ask for explicit confirmation, but that is a guardrail, not
an access boundary:

- `all=true` always requires `confirm=true`.
- `unban_ip` filtered only by `type`/`scenario` requires `confirm=true`.
- `delete_alerts` without a narrow target (`id`, `ip`, `range`, or
  `scope`+`value`) — e.g. `scenario`, `origin`, `type`, time filters or
  `has_active_decision` alone — requires `confirm=true`.
- `ban_ip` refuses allowlisted targets unless `force=true`; `check_allowlist`
  first when in doubt.

The server instructions repeat these rules to the model, but any client that
can reach the endpoint can also confirm: the real protection is the token,
the bind address, and the read-only default.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `401 Unauthorized` | Missing or invalid HTTP bearer token. In HTTP mode, send `Authorization: Bearer <CROWDSEC_MCP_HTTP_TOKEN>`. |
| `403 access forbidden from this IP` on `delete_alerts` | CrowdSec only allows alert deletion from the LAPI host. Use `unban_ip` for decisions, or enable `delete_alerts` only in a deployment next to the LAPI. |
| `<ip> is allowlisted by item ...` | The target matches an allowlist. Use `force=true` only if you really want to ban an allowlisted value. |
| A tool is missing from `listTools` | It may be a write tool while `CROWDSEC_MCP_READONLY=true`, a watcher tool in bouncer mode, or hidden by `CROWDSEC_MCP_TOOLS` / `CROWDSEC_MCP_DISABLE_TOOLS`. |
| `invalid duration` | Use durations such as `30m`, `4h`, `7d`, `3650d`, or `1h30m`. |
| `Duration ... exceeds maximum allowed ...` | The duration is above `CROWDSEC_MCP_MAX_BAN_DURATION`. Lower it or use `force=true`. |

## Development

```bash
pnpm --filter crowdsec-mcp build
pnpm --filter crowdsec-mcp test
node packages/crowdsec-mcp/dist/index.js --help
```

The test suite includes unit tests, HTTP contract tests for the CrowdSec client, and a stdio end-to-end test that spawns the built binary against a fake LAPI. The integration test against a real CrowdSec LAPI in Docker also runs in CI (see the HTTP E2E script below).

Live client checks are opt-in:

```bash
CROWDSEC_LIVE=1 \
CROWDSEC_URL=https://crowdsec:8080 \
CROWDSEC_API_KEY=your-bouncer-key \
pnpm --filter crowdsec-client exec vitest run tests/Live/live.test.ts
```

Set `CROWDSEC_MACHINE_ID` and `CROWDSEC_PASSWORD` instead of `CROWDSEC_API_KEY` to exercise watcher mode, including allowlists.

### Integration test against a real LAPI

Start a disposable CrowdSec container:

```bash
docker run -d --name crowdsec-mcp-test \
  -p 18080:8080 \
  -v crowdsec-mcp-data:/var/lib/crowdsec/data \
  crowdsecurity/crowdsec:latest
```

Create credentials and seed data:

```bash
export BOUNCER_KEY=$(docker exec crowdsec-mcp-test cscli bouncers add crowdsec-mcp-bouncer -o raw)
docker exec crowdsec-mcp-test cscli machines add crowdsec-mcp-watcher --auto -f -
# export CROWDSEC_MACHINE_ID=<login> and CROWDSEC_PASSWORD=<password> from the output
docker exec crowdsec-mcp-test cscli allowlists create test-allowlist -d "mcp integration"
docker exec crowdsec-mcp-test cscli allowlists add test-allowlist 192.0.2.10 -d "mcp test"
docker exec crowdsec-mcp-test cscli decisions add --ip 203.0.113.10 --duration 24h --reason "mcp integration"
```

Run the integration test:

```bash
CROWDSEC_INTEGRATION=1 \
CROWDSEC_INTEGRATION_WRITE=1 \
CROWDSEC_URL=http://127.0.0.1:18080 \
CROWDSEC_API_KEY="$BOUNCER_KEY" \
CROWDSEC_MACHINE_ID=<login> \
CROWDSEC_PASSWORD=<password> \
pnpm --filter crowdsec-mcp exec vitest run tests/integration/live.test.ts
```

`delete_alerts` is not covered by the integration test because it requires the MCP to run next to the LAPI. Clean up with:

```bash
docker rm -f crowdsec-mcp-test && docker volume rm crowdsec-mcp-data
```

### HTTP transport and passthrough E2E

This E2E starts a disposable CrowdSec LAPI, an nginx log generator, and two MCP HTTP servers:

- `mcp` on `23939` with a service token;
- `mcp-open` on `23940` without a service token;
- both share CrowdSec's network namespace, so `delete_alerts` works.

Requirements: Docker Compose v2, `pnpm`, `jq` and `openssl`. The script builds the client and MCP first unless `E2E_SKIP_BUILD=1` is set.

```bash
pnpm --filter crowdsec-mcp test:e2e:http
```

The test waits for alerts generated by nginx logs, then exercises bouncer/watcher tool filtering, per-request credentials, service-token gating, CIDR filtering of decisions, `ban_ip`, `unban_ip` by range, and local-only `delete_alerts`. It then seeds an allowlist and a decision and runs `tests/integration/live.test.ts` against the same LAPI. The orchestration script lives in `.github/scripts/mcp-http-e2e.sh`.

Ports can be overridden with `E2E_LAPI_PORT`, `E2E_MCP_PORT`, and `E2E_MCP_OPEN_PORT`. Use `E2E_KEEP=1` to keep the stack for debugging. The stack is removed automatically, including volumes, unless `E2E_KEEP=1` is set.

The GitHub Actions workflow is `.github/workflows/mcp-http-e2e.yml`; it runs on MCP/client/workflow changes, on pushes to `main`, and on manual dispatch.

## License

MIT
