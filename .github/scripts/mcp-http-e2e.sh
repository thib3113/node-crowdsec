#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/packages/crowdsec-mcp/tests/e2e/http/compose.yaml"
PROJECT="crowdsec-mcp-e2e"

export REPO_ROOT
export E2E_LAPI_PORT="${E2E_LAPI_PORT:-28080}"
export E2E_MCP_PORT="${E2E_MCP_PORT:-23939}"
export E2E_MCP_OPEN_PORT="${E2E_MCP_OPEN_PORT:-23940}"
export E2E_MCP_TOKEN="${E2E_MCP_TOKEN:-$(openssl rand -hex 24)}"

compose() {
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
}

cleanup() {
    local status=$?
    trap - EXIT

    if [[ "$status" -ne 0 ]]; then
        compose ps || true
        compose logs --no-color --tail=200 || true
    fi

    if [[ "${E2E_KEEP:-0}" != "1" ]]; then
        compose down -v --remove-orphans >/dev/null 2>&1 || true
    else
        echo "E2E_KEEP=1: stack left running"
        echo "LAPI: http://127.0.0.1:${E2E_LAPI_PORT}"
        echo "MCP:  http://127.0.0.1:${E2E_MCP_PORT}/mcp"
        echo "MCP open: http://127.0.0.1:${E2E_MCP_OPEN_PORT}/mcp"
    fi

    exit "$status"
}
trap cleanup EXIT

if [[ "${E2E_SKIP_BUILD:-0}" != "1" ]]; then
    (cd "$REPO_ROOT" && pnpm --filter crowdsec-client build && pnpm --filter crowdsec-mcp build)
fi

compose down -v --remove-orphans >/dev/null 2>&1 || true
compose up -d crowdsec nginx-logs

wait_for_lapi() {
    local i
    for i in $(seq 1 60); do
        if compose exec -T crowdsec cscli lapi status >/dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    return 1
}

if ! wait_for_lapi; then
    echo "CrowdSec LAPI did not become ready" >&2
    exit 1
fi

if ! compose exec -T crowdsec cscli collections install crowdsecurity/nginx; then
    echo "Failed to install crowdsecurity/nginx" >&2
    exit 1
fi

compose restart crowdsec

if ! wait_for_lapi; then
    echo "CrowdSec LAPI did not become ready after restart" >&2
    exit 1
fi

compose up -d mcp mcp-open

wait_for_mcp() {
    local url=$1
    local i
    for i in $(seq 1 60); do
        local code
        code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$url" \
            -H 'content-type: application/json' -d '{}' 2>/dev/null || true)
        if [[ "$code" = "401" ]]; then
            return 0
        fi
        sleep 1
    done
    return 1
}

MCP_URL="http://127.0.0.1:${E2E_MCP_PORT}/mcp"
MCP_OPEN_URL="http://127.0.0.1:${E2E_MCP_OPEN_PORT}/mcp"

if ! wait_for_mcp "$MCP_URL" || ! wait_for_mcp "$MCP_OPEN_URL"; then
    echo "MCP HTTP endpoints did not become ready" >&2
    exit 1
fi

BOUNCER_KEY=$(compose exec -T crowdsec cscli bouncers add e2e-bouncer -o raw 2>&1 | tr -d '\r' | tail -n1 | tr -d '\n')
MACHINE_ID="e2e-watcher"
MACHINE_PASSWORD="$(openssl rand -hex 16)"

if ! compose exec -T crowdsec cscli machines add "$MACHINE_ID" --password "$MACHINE_PASSWORD" -f - >/dev/null 2>&1; then
    echo "Failed to create E2E watcher machine" >&2
    exit 1
fi

if [[ -z "$BOUNCER_KEY" ]]; then
    echo "Failed to create E2E bouncer" >&2
    exit 1
fi

LOGIN_JSON=$(curl -sS -X POST "http://127.0.0.1:${E2E_LAPI_PORT}/v1/watchers/login" \
    -H 'content-type: application/json' \
    --data "{\"machine_id\":\"$MACHINE_ID\",\"password\":\"$MACHINE_PASSWORD\"}" 2>/dev/null || true)
WATCHER_TOKEN=$(printf '%s' "$LOGIN_JSON" | jq -r '.token // empty')

if [[ -z "$WATCHER_TOKEN" ]]; then
    echo "E2E watcher login failed (machine: $MACHINE_ID)" >&2
    compose exec -T crowdsec cscli machines list || true
    exit 1
fi

export CROWDSEC_MCP_HTTP_E2E=1
export CROWDSEC_MCP_HTTP_URL="$MCP_URL"
export CROWDSEC_MCP_HTTP_OPEN_URL="$MCP_OPEN_URL"
export CROWDSEC_URL="http://127.0.0.1:${E2E_LAPI_PORT}"
export CROWDSEC_MCP_HTTP_TOKEN="$E2E_MCP_TOKEN"
export CROWDSEC_BOUNCER_KEY="$BOUNCER_KEY"
export CROWDSEC_WATCHER_TOKEN="$WATCHER_TOKEN"

cd "$REPO_ROOT"
pnpm --filter crowdsec-mcp exec vitest run tests/e2e/http/live.test.ts

# Seed the fixtures used by the live integration test, then run it against the
# same LAPI. It is kept separate so the HTTP E2E cannot delete its alerts first.
if ! compose exec -T crowdsec cscli allowlists create test-allowlist -d "mcp integration" >/dev/null; then
    echo "Failed to create integration allowlist" >&2
    exit 1
fi
if ! compose exec -T crowdsec cscli allowlists add test-allowlist 192.0.2.10 -d "mcp test" >/dev/null; then
    echo "Failed to seed integration allowlist" >&2
    exit 1
fi
if ! compose exec -T crowdsec cscli decisions add --ip 203.0.113.10 --duration 24h --reason "mcp integration" >/dev/null; then
    echo "Failed to seed integration decision" >&2
    exit 1
fi

export CROWDSEC_INTEGRATION=1
export CROWDSEC_INTEGRATION_WRITE=1
export CROWDSEC_MACHINE_ID="$MACHINE_ID"
export CROWDSEC_PASSWORD="$MACHINE_PASSWORD"
export CROWDSEC_API_KEY="$BOUNCER_KEY"

pnpm --filter crowdsec-mcp exec vitest run tests/integration/live.test.ts
