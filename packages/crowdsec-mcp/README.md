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

> Read <https://raw.githubusercontent.com/thib3113/node-crowdsec/main/llms.txt>, then the `crowdsec-mcp` README it links, and give me a brief of what the MCP can do. Then explain how to install and configure it for my client (Claude Desktop/Code, Cursor or opencode). Never ask me for credentials: just tell me which environment variables to set. Also explain the security impact before enabling `ban_ip`, `unban_ip` or `delete_alerts`.

A [Model Context Protocol](https://modelcontextprotocol.io) server for CrowdSec. It exposes decisions, alerts and allowlists to an LLM as readable Markdown, with guarded write operations for watcher credentials.

- `npx`-friendly, stdio by default
- Bouncer API key, watcher machine credentials, or mutual TLS
- Read-only by default
- Optional Streamable HTTP transport with a bearer token (required outside passthrough)
- Server-side tool filtering
- cscli-compatible behavior for decisions, alerts and allowlists

Guides (authentication, deployment, security, write operations, client
configuration, HTTP transport, troubleshooting) live in the
[MCP server wiki](https://github.com/thib3113/node-crowdsec/wiki/MCP-Server).

## Requirements

- Node.js 24 or newer.
- A reachable CrowdSec Local API (LAPI), `v1.0.0` or newer.

Some tools require a newer LAPI: allowlists need `1.6.6` (bulk check `1.6.9`),
alert deletion by id needs `1.4.2`, and the `kind` alert filter needs `1.7.7`.
On older servers the affected tools return an error instead of an empty result.
See [`docs/api-compatibility.md`](../../docs/api-compatibility.md) for details.

## Quick start

```bash
npx -y crowdsec-mcp
```

From a checkout, before the npm release or for development:

```bash
pnpm --filter crowdsec-mcp build
node packages/crowdsec-mcp/dist/index.js
```

With a bouncer API key (read decisions):

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

### Docker image

Published as `ghcr.io/thib3113/crowdsec-mcp` and `docker.io/thib3113/crowdsec-mcp`
(multi-arch `linux/amd64`, `linux/arm64`). `latest` follows `main`; pin a version
tag or `sha-<commit>` for a reproducible deployment.

## Authentication

Every supplied credential is enabled at the same time: a bouncer API key serves
the fast decision path, the watcher handles alerts, allowlists and writes.
`CROWDSEC_AUTH` only forces one mode (for example to disambiguate a mutual-TLS
certificate). All three TLS files are required together, and mutual TLS defaults
to `watcher` without `CROWDSEC_AUTH`.

See [Authentications](https://github.com/thib3113/node-crowdsec/wiki/Authentications)
for creating the credentials.

### Passthrough credentials

With `CROWDSEC_MCP_PASSTHROUGH=true` (HTTP transport only), every request carries
its own LAPI credentials:

- `X-CrowdSec-Api-Key`: bouncer API key (fast `/v1/decisions` path).
- `X-CrowdSec-Token`: watcher JWT (alerts, allowlists, writes).

Both headers may be sent together; the request then gets the union of the
bouncer and watcher capabilities. Mutual TLS is rejected in passthrough mode
because certificates cannot be selected per request.

**Security requirement.** The reverse proxy in front of the MCP server must
strip any incoming `X-CrowdSec-*` header and inject only the credentials it
vouches for. Otherwise a caller can add the missing header and combine its own
credential with the proxy-injected identity. Keep `CROWDSEC_MCP_HTTP_TOKEN` set
in passthrough mode so callers must authenticate to the MCP server itself.

### Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `CROWDSEC_URL` | CrowdSec LAPI URL | required |
| `CROWDSEC_AUTH` | Force `bouncer` or `watcher`; omit to enable every supplied credential | auto |
| `CROWDSEC_LAPI_VERSION` | Declared LAPI version (e.g. `1.8.2`); resolves version-gated filters without probing | auto |
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

`CROWDSEC_API_KEY`, `CROWDSEC_MACHINE_ID`, `CROWDSEC_PASSWORD` and
`CROWDSEC_MCP_HTTP_TOKEN` also accept a `_FILE` variant. Trailing line endings
written by Docker/Kubernetes secrets are stripped; leading and trailing spaces
are preserved because they can be part of a password. Precedence: command-line
flag > plain variable > `_FILE`. A missing file is reported by naming the
variable, never the path.

Secrets should stay in the environment or in secret files. Command-line
arguments are visible in the process list.

### CLI arguments

Most environment variables have a kebab-case equivalent: `--url`, `--auth`,
`--api-key`, `--machine-id`, `--password`, `--tls-cert`, `--tls-key`, `--tls-ca`,
`--timeout`, `--transport`, `--http-host`, `--http-port`, `--http-token`,
`--passthrough`, `--enable-alert-delete`, `--allow-alert-delete-without-token`,
`--tools`, `--disable-tools`, `--max-results`, `--max-ban-duration`. Exceptions:
`CROWDSEC_STRICT_SSL` uses `--insecure`, and `CROWDSEC_MCP_READONLY` uses
`--readonly`/`--write`. Use `--help` for the full list.

## Tools

Read-only tools are available according to the configured credentials and their
capabilities. Write tools are hidden by default and require
`CROWDSEC_MCP_READONLY=false`.

| Tool | Kind | Auth | Description |
| --- | --- | --- | --- |
| `crowdsec_status` | read | any | Connection status, auth mode, capabilities and active tools |
| `list_decisions` | read | bouncer, watcher | Active decisions, like `cscli decisions list` |
| `get_decision` | read | bouncer, watcher | Get an active decision by ID; alert context is included on the watcher path |
| `list_alerts` | read | watcher | Alerts with filters, like `cscli alerts list` |
| `get_alert` | read | watcher | Alert details, decisions, meta and events |
| `list_allowlists` | read | watcher | Allowlists and their size |
| `get_allowlist` | read | watcher | Allowlist details and items |
| `check_allowlist` | read | watcher | Check one or many IPs/ranges against allowlists |
| `ban_ip` | write | watcher | Add a decision via the cscli alert payload |
| `unban_ip` | write | watcher | Delete decisions by ID, filters, or all with confirmation |
| `delete_alerts` | write | watcher | Opt-in; delete alerts by ID, filters, or all with confirmation (local deployment only) |

When read-only is enabled, write tools are not advertised at all: the model
cannot call them.

**Safety.** Write tools are hidden unless `CROWDSEC_MCP_READONLY=false`.
`delete_alerts` also requires `CROWDSEC_MCP_ENABLE_ALERT_DELETE=true` and a
deployment next to the LAPI. Over HTTP, require `CROWDSEC_MCP_HTTP_TOKEN`,
restrict the bind address, and terminate TLS in front. Keep secrets in the
environment or in `_FILE` variables, not in command-line arguments.

```bash
# Only these tools are registered
CROWDSEC_MCP_TOOLS=crowdsec_status,list_decisions,list_alerts

# Hide specific tools
CROWDSEC_MCP_DISABLE_TOOLS=delete_alerts,ban_ip
```

The allowlist wins over the denylist, and read-only mode always wins over both.
Unknown names in `CROWDSEC_MCP_TOOLS` fail when the toolset is built: at startup
in static mode, and on the request in passthrough mode.

The server also exposes resources (`crowdsec://docs/overview`, `concepts`,
`triage`), prompts (`triage_alerts`, `investigate_ip`, `banned_from_country`) and
its own instructions to the model. See the
[MCP server wiki](https://github.com/thib3113/node-crowdsec/wiki/MCP-Server#documentation-for-the-model).

## Development

```bash
pnpm --filter crowdsec-mcp build
pnpm --filter crowdsec-mcp test
pnpm --filter crowdsec-mcp test:e2e:http
```

The test suite includes unit tests, HTTP contract tests and a stdio end-to-end
test. The HTTP transport and passthrough E2E runs in
`.github/workflows/mcp-http-e2e.yml` (orchestration:
`.github/scripts/mcp-http-e2e.sh`).

## License

MIT
