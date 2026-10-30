# crowdsec-mcp

Model Context Protocol (MCP) server for [CrowdSec](https://www.crowdsec.net/):
let an LLM client (Claude Desktop/Code, Cursor, opencode, ...) inspect decisions
and alerts, manage allowlists, and optionally ban/unban IPs.

The image is published to:

- `ghcr.io/thib3113/crowdsec-mcp`
- `docker.io/thib3113/crowdsec-mcp`

Tags: released versions (e.g. `0.0.5`), `latest`, and `sha-<commit>`.
Multi-arch: `linux/amd64`, `linux/arm64`.

`latest` is rebuilt and pushed on every merge to `main`, including automated
dependency and base-image updates, so it follows the main branch and can be
ahead of the last release. Pin a version tag or `sha-<commit>` for a
reproducible deployment.

## Quick start

The MCP must reach the CrowdSec Local API (LAPI). A shared deployment keeps the
MCP next to CrowdSec on the same network namespace:

```yaml
services:
  crowdsec:
    image: crowdsecurity/crowdsec:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "3939:3939"
    volumes:
      - crowdsec-data:/var/lib/crowdsec/data
      - crowdsec-config:/etc/crowdsec

  crowdsec-mcp:
    image: ghcr.io/thib3113/crowdsec-mcp:latest
    restart: unless-stopped
    init: true
    network_mode: "service:crowdsec"
    depends_on:
      - crowdsec
    environment:
      CROWDSEC_URL: http://127.0.0.1:8080
      CROWDSEC_MCP_TRANSPORT: http
      CROWDSEC_MCP_HTTP_HOST: 0.0.0.0
      CROWDSEC_MCP_HTTP_PORT: "3939"
      CROWDSEC_MCP_PASSTHROUGH: "true"
      CROWDSEC_MCP_READONLY: "false"
      CROWDSEC_MCP_ENABLE_ALERT_DELETE: "true"
      CROWDSEC_MCP_HTTP_TOKEN: ${CROWDSEC_MCP_HTTP_TOKEN:-}
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL

volumes:
  crowdsec-data:
  crowdsec-config:
```

Then point your MCP client at `http://127.0.0.1:3939/mcp` with the bearer token
set in `CROWDSEC_MCP_HTTP_TOKEN`.

For a stdio setup, run the container on demand instead:

```bash
docker run --rm -i \
  -e CROWDSEC_URL=https://crowdsec:8080 \
  -e CROWDSEC_API_KEY=your-bouncer-key \
  ghcr.io/thib3113/crowdsec-mcp:latest
```

## Authentication

The mode is auto-detected from the credentials, or forced with `CROWDSEC_AUTH`.

| Mode | Credentials | Capabilities |
| --- | --- | --- |
| `bouncer` | `CROWDSEC_API_KEY` | read decisions |
| `watcher` | `CROWDSEC_MACHINE_ID` + `CROWDSEC_PASSWORD` | alerts, decisions, allowlists, writes |
| either | `CROWDSEC_TLS_CERT` + `CROWDSEC_TLS_KEY` + `CROWDSEC_TLS_CA` | mutual TLS |

## Main environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `CROWDSEC_URL` | CrowdSec LAPI URL | required |
| `CROWDSEC_AUTH` | `bouncer` or `watcher` | auto |
| `CROWDSEC_API_KEY` | Bouncer API key | - |
| `CROWDSEC_MACHINE_ID` | Watcher machine ID | - |
| `CROWDSEC_PASSWORD` | Watcher password | - |
| `CROWDSEC_STRICT_SSL` | Validate TLS certificates | `true` |
| `CROWDSEC_MCP_TRANSPORT` | `stdio` or `http` | `stdio` |
| `CROWDSEC_MCP_PASSTHROUGH` | Per-request LAPI credentials (HTTP) | `false` |
| `CROWDSEC_MCP_HTTP_HOST` | HTTP bind host | `127.0.0.1` |
| `CROWDSEC_MCP_HTTP_PORT` | HTTP bind port | `3939` |
| `CROWDSEC_MCP_HTTP_TOKEN` | HTTP bearer token | required for HTTP |
| `CROWDSEC_MCP_READONLY` | Hide write tools | `true` |
| `CROWDSEC_MCP_ENABLE_ALERT_DELETE` | Expose `delete_alerts` | `false` |
| `CROWDSEC_MCP_TOOLS` | Comma-separated tool allowlist | all |
| `CROWDSEC_MCP_DISABLE_TOOLS` | Comma-separated tool denylist | none |
| `CROWDSEC_MCP_MAX_BAN_DURATION` | Max ban duration without `force` | `24h` |

Secrets should be provided through the environment, not CLI arguments.

## Security

- Read-only by default: write tools (`ban_ip`, `unban_ip`, `delete_alerts`) are
  only exposed when explicitly enabled.
- HTTP transport requires a bearer token. Keep write tools disabled unless you
  trust every client that can reach the port.
- `delete_alerts` only works when the MCP runs next to the LAPI (local-only
  endpoint), which is why the shared deployment above uses the CrowdSec network
  namespace.
- The image runs with a read-only filesystem, `no-new-privileges`, and all
  capabilities dropped.

## Links

- Full documentation: <https://github.com/thib3113/node-crowdsec/tree/main/packages/crowdsec-mcp>
- npm package: <https://www.npmjs.com/package/crowdsec-mcp>
- Issues: <https://github.com/thib3113/node-crowdsec/issues>

## License

MIT
