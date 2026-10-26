# crowdsec-mcp

**Give this to your AI agent.** Copy/paste this prompt:

> Read https://raw.githubusercontent.com/thib3113/node-crowdsec/main/packages/crowdsec-mcp/README.md and give me a brief of what the MCP can do, then explain how to install and configure it for my client (Claude Desktop/Code, Cursor or opencode). Never ask me for credentials: just tell me which environment variables to set. Also explain the security impact before enabling `ban_ip`, `unban_ip` or `delete_alerts`.

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

If both a bouncer key and machine credentials are present, set `CROWDSEC_AUTH` explicitly. Without it, the bouncer API key takes precedence.

### Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `CROWDSEC_URL` | CrowdSec LAPI URL | required |
| `CROWDSEC_AUTH` | `bouncer` or `watcher` | auto |
| `CROWDSEC_API_KEY` | Bouncer API key | — |
| `CROWDSEC_MACHINE_ID` | Watcher machine ID | — |
| `CROWDSEC_PASSWORD` | Watcher password | — |
| `CROWDSEC_TLS_CERT` | Client certificate path | — |
| `CROWDSEC_TLS_KEY` | Client key path | — |
| `CROWDSEC_TLS_CA` | CA certificate path | — |
| `CROWDSEC_STRICT_SSL` | Validate TLS certificates | `true` |
| `CROWDSEC_TIMEOUT` | HTTP timeout in milliseconds | `10000` |
| `CROWDSEC_MCP_TRANSPORT` | `stdio` or `http` | `stdio` |
| `CROWDSEC_MCP_HTTP_HOST` | HTTP bind host | `127.0.0.1` |
| `CROWDSEC_MCP_HTTP_PORT` | HTTP bind port | `3939` |
| `CROWDSEC_MCP_HTTP_TOKEN` | HTTP bearer token | required for HTTP |
| `CROWDSEC_MCP_READONLY` | Hide write tools | `true` |
| `CROWDSEC_MCP_TOOLS` | Comma-separated allowlist of tools | all |
| `CROWDSEC_MCP_DISABLE_TOOLS` | Comma-separated denylist of tools | none |
| `CROWDSEC_MCP_MAX_RESULTS` | Default result limit | `25` |
| `CROWDSEC_MCP_MAX_BAN_DURATION` | Maximum ban duration without `force` | `24h` |

Secrets should stay in the environment. Command-line arguments are available for convenience, but are visible in the process list.

### CLI arguments

Every environment variable above has a kebab-case argument equivalent: `--url`, `--auth`, `--api-key`, `--machine-id`, `--password`, `--tls-cert`, `--tls-key`, `--tls-ca`, `--insecure`, `--timeout`, `--transport`, `--http-host`, `--http-port`, `--http-token`, `--readonly`, `--write`, `--tools`, `--disable-tools`, `--max-results`, `--max-ban-duration`.

Use `--help` for the full list.

## Tools

Read-only tools are always available according to the authentication mode. Write tools are hidden by default and require `CROWDSEC_MCP_READONLY=false`.

| Tool | Kind | Auth | Description |
| --- | --- | --- | --- |
| `crowdsec_status` | read | any | Connection status, auth mode, capabilities and active tools |
| `list_decisions` | read | bouncer, watcher | Active decisions, like `cscli decisions list` |
| `list_alerts` | read | watcher | Alerts with filters, like `cscli alerts list` |
| `get_alert` | read | watcher | Alert details, decisions, meta and events |
| `list_allowlists` | read | watcher | Allowlists and their size |
| `get_allowlist` | read | watcher | Allowlist details and items |
| `check_allowlist` | read | watcher | Check one or many IPs/ranges against allowlists |
| `ban_ip` | write | watcher | Add a decision via the cscli alert payload |
| `unban_ip` | write | watcher | Delete decisions by ID, filters, or all with confirmation |
| `delete_alerts` | write | watcher | Delete alerts by ID, filters, or all with confirmation |

### Read-only by default

```bash
CROWDSEC_MCP_READONLY=true   # default: write tools are not registered
CROWDSEC_MCP_READONLY=false  # expose write tools
```

When read-only is enabled, write tools are not advertised at all: the model cannot call them.

### Limit the tools exposed to the model

```bash
# Only these tools are registered
CROWDSEC_MCP_TOOLS=crowdsec_status,list_decisions,list_alerts

# Hide specific tools
CROWDSEC_MCP_DISABLE_TOOLS=delete_alerts,ban_ip
```

The allowlist wins over the denylist, and read-only mode always wins over both. Unknown names in `CROWDSEC_MCP_TOOLS` make the server fail at startup, so typos are visible immediately.

## Write operations

### `ban_ip`

Mirrors `cscli decisions add`:

```text
ban_ip(ip="203.0.113.10", duration="4h", type="ban", reason="manual block")
ban_ip(range="203.0.113.0/24", duration="1h", type="captcha")
```

- IP and CIDR inputs are validated before sending anything.
- The value is checked against allowlists first. If it is allowlisted, the call is refused unless `force=true`.
- `duration` is limited by `CROWDSEC_MCP_MAX_BAN_DURATION` unless `force=true`.
- The decision is created through `POST /v1/alerts`, exactly like cscli. It is therefore visible as an alert, and may be forwarded to CAPI depending on your CrowdSec configuration.
- `origin` is always `cscli`; the MCP does not impersonate a scenario.

### `unban_ip` and `delete_alerts`

Both require at least one filter, an ID, or an explicit destructive confirmation:

```text
unban_ip(ip="203.0.113.10")
unban_ip(id="42")
unban_ip(all=true, confirm=true)
```

`all=true` without `confirm=true` is rejected.

> **Alert deletion is local-only in CrowdSec.** The LAPI only allows `delete_alerts` from the LAPI host. A remote watcher receives `403 access forbidden from this IP`. `unban_ip` (decision deletion) works remotely; `delete_alerts` is intended for an MCP running on the LAPI host.

## Allowlists

Allowlists are read/check only. The CrowdSec local API exposes no create, update or delete endpoint for allowlists: those operations are done with `cscli allowlists ...` or the CrowdSec Console. The MCP therefore provides:

- `list_allowlists`
- `get_allowlist`
- `check_allowlist`

`ban_ip` automatically calls `check_allowlist` for IP and range scopes, like cscli.

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

## Security

- Read-only mode is enabled by default. Keep it that way unless the model really needs writes.
- Keep credentials in the environment, not in command-line arguments: arguments are visible in the process list.
- HTTP always requires a bearer token, including on `127.0.0.1`. The server refuses to start in HTTP mode without one.
- `ban_ip`, `unban_ip` and `delete_alerts` are destructive. Restrict them with `CROWDSEC_MCP_TOOLS` or keep read-only mode.
- `ban_ip` creates a real CrowdSec alert and decision. It may be forwarded to CAPI depending on your CrowdSec configuration.
- Use `CROWDSEC_MCP_TOOLS` to expose the smallest useful surface to the model.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `401 Unauthorized` | Missing or invalid HTTP bearer token. In HTTP mode, send `Authorization: Bearer <CROWDSEC_MCP_HTTP_TOKEN>`. |
| `403 access forbidden from this IP` on `delete_alerts` | CrowdSec only allows alert deletion from the LAPI host. Run the MCP on that host, or use `cscli alerts delete` locally. `unban_ip` is not affected. |
| `<ip> is allowlisted by item ...` | The target matches an allowlist. Use `force=true` only if you really want to ban an allowlisted value. |
| A tool is missing from `listTools` | It may be a write tool while `CROWDSEC_MCP_READONLY=true`, a watcher tool in bouncer mode, or hidden by `CROWDSEC_MCP_TOOLS` / `CROWDSEC_MCP_DISABLE_TOOLS`. |
| `invalid duration` | Use cscli-style durations such as `30m`, `4h`, `7d`, or `1h30m`. |
| `Duration ... exceeds maximum allowed ...` | The duration is above `CROWDSEC_MCP_MAX_BAN_DURATION`. Lower it or use `force=true`. |

## Output

The MCP protocol itself is JSON-RPC, but tool results are Markdown text, not JSON dumps. Lists are tables with a summary and a truncation hint:

```text
1 decision total

| Type | Scope | Value        | Origin | Scenario | Expires   | Simulated | Alert ID |
| ---- | ----- | ------------ | ------ | -------- | --------- | --------- | -------- |
| ban  | Ip    | 203.0.113.10 | cscli  | manual   | in 3h 12m | no        | 42       |
```

Dates are shown in ISO form with a relative expiry. Large lists are truncated to `CROWDSEC_MCP_MAX_RESULTS` with an explicit hint to narrow the filters or increase `limit`.

## Development

```bash
pnpm --filter crowdsec-mcp build
pnpm --filter crowdsec-mcp test
node packages/crowdsec-mcp/dist/index.js --help
```

The test suite includes unit tests, HTTP contract tests for the CrowdSec client, and a stdio end-to-end test that spawns the built binary against a fake LAPI. An opt-in integration test also runs against a real CrowdSec LAPI in Docker.

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

Set `CROWDSEC_INTEGRATION_LOCAL_DELETE=1` only when the MCP and LAPI share localhost and alert deletion is expected to succeed. Clean up with:

```bash
docker rm -f crowdsec-mcp-test && docker volume rm crowdsec-mcp-data
```

## License

MIT
