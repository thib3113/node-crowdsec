# TODO

## Deployment notes

### Do not modify the CrowdSec image

Keep `crowdsecurity/crowdsec` as-is. The MCP is a separate container (or a host
process). Do not add Node.js or the MCP into the CrowdSec image.

### Recommended local deployment: sidecar in CrowdSec's network namespace

`delete_alerts` is local-only on the CrowdSec LAPI. To make it work, the MCP
must reach the LAPI from `127.0.0.1`. The simplest way is to share CrowdSec's
network namespace:

```yaml
services:
  crowdsec:
    image: crowdsecurity/crowdsec:latest
    ports:
      - "8080:8080"
      - "3939:3939" # published by crowdsec because the MCP shares its netns
    volumes:
      - crowdsec-data:/var/lib/crowdsec/data

  crowdsec-mcp:
    image: crowdsec-mcp:local # build/publish the MCP image separately
    network_mode: "service:crowdsec"
    depends_on:
      - crowdsec
    environment:
      CROWDSEC_URL: http://127.0.0.1:8080
      CROWDSEC_MCP_TRANSPORT: http
      CROWDSEC_MCP_HTTP_HOST: 0.0.0.0
      CROWDSEC_MCP_HTTP_PORT: 3939
      CROWDSEC_MCP_PASSTHROUGH: "true"
      # CROWDSEC_MCP_HTTP_TOKEN: change-me # optional service gate
      CROWDSEC_MCP_READONLY: "false"
      CROWDSEC_MCP_ENABLE_ALERT_DELETE: "true"

volumes:
  crowdsec-data:
```

Important:

- `ports` must be declared on the `crowdsec` service. Docker does not allow
  `ports` on a service using `network_mode: "service:..."`.
- The MCP listens on `0.0.0.0:3939` inside the shared netns.
- `CROWDSEC_URL` is `http://127.0.0.1:8080` inside the shared netns.
- In passthrough mode, clients send one of:
  - `X-CrowdSec-Api-Key: <bouncer key>` (read decisions only)
  - `X-CrowdSec-Token: <watcher JWT>` (watcher tools)
- If `CROWDSEC_MCP_HTTP_TOKEN` is set, requests must also send
  `Authorization: Bearer <token>`.
- Without a service token, `delete_alerts` is hidden unless
  `CROWDSEC_MCP_ALLOW_ALERT_DELETE_WITHOUT_TOKEN=true`.
- `delete_alerts` remains local-only even with passthrough.

### Other deployment modes

| Mode | `delete_alerts` | CrowdSec image modified |
| --- | --- | --- |
| Sidecar sharing CrowdSec's netns | yes | no |
| MCP on the host, CrowdSec installed natively | yes | no image |
| MCP on a Docker bridge (`http://crowdsec:8080`) | no (403) | no |
| MCP and CrowdSec both with `network_mode: host` | yes | no |

If `delete_alerts` is not needed, a regular Docker bridge network is enough.
`unban_ip` works remotely.

## Docker image work (later)

- [x] Add a `Dockerfile` for the MCP package.
- [x] Use a multi-stage build with `node:26-alpine`.
- [x] Build `crowdsec-client` and `crowdsec-mcp` in the build stage.
- [x] Produce a small runtime image with only production dependencies.
- [x] Run as a non-root user.
- [x] Add a `HEALTHCHECK` (or document an external one).
- [x] Add a production `compose.yaml` based on the sidecar pattern above.
- [x] Add a `docker-mcp.yml` workflow publishing
      `ghcr.io/thib3113/crowdsec-mcp` (on dependency changes and tags).
- [x] Keep the CrowdSec image unmodified.
- [x] Verify `delete_alerts` from the sidecar deployment.
- [x] Verify passthrough with bouncer keys and watcher JWTs.
- [x] Verify the service-token gate and the
      `ALLOW_ALERT_DELETE_WITHOUT_TOKEN` override.

## Release prerequisites

- [ ] Publish `crowdsec-client@1.3.0` (allowlists, delete query params,
      `getById` typing). It is currently not on npm.
- [x] Resolve the `follow-redirects` Snyk finding before the client release.
- [x] Update `crowdsec-client` to `axios@1.21.0` (`follow-redirects@1.16.2`).
- [ ] Publish `crowdsec-mcp` (package is `0.1.0`; an npm placeholder
      `0.0.1-alpha.0` may still exist).
- [ ] Ensure the release workflow rewrites `workspace:^` correctly. `npm pack`
      keeps `workspace:^`; use `pnpm publish` (or replace the dependency with a
      published semver range).
- [ ] Configure npm trusted publishing (OIDC) after the first publish.
- [ ] Confirm Node.js `>=24` is acceptable for the published package.

## Remaining QA items

- [ ] `origin` / `kind` values with no match on list tools still return an
      empty result (not an error).
- [ ] Allowlist write tools are impossible through the LAPI (use `cscli` or the
      Console).
- [ ] `list_bouncers`, LAPI health/version/metrics, raw API passthrough and
      simulated-object creation are not exposed.
- [ ] `delete_alerts(all=true)` is destructive and local-only; it is gated by
      `confirm=true`.
- [ ] The current opencode session only sees `get_decision` after a restart.
- [ ] Add a cheap total-count source or pagination for the list tools. An
      explicit `limit` currently fetches all matching rows so the hidden count
      is exact; this can be expensive on very large datasets.
- [ ] Add sort/offset (or cursor) pagination to `list_alerts` and
      `list_decisions`.
- [ ] Add a dry-run/preview mode for `delete_alerts` and `unban_ip(all=true)`.
- [ ] Decide whether `since=0s` / `until=0s` should be accepted; they are
      currently rejected by the positive-duration parser.
- [ ] Re-run the QA matrix after the next live deployment.
