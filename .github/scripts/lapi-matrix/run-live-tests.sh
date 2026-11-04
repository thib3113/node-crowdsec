#!/usr/bin/env bash
# Run the crowdsec-client live E2E suite against several CrowdSec LAPI
# versions in Docker. Used by .github/workflows/client-live-matrix.yml, and
# usable locally.
#
# Usage:
#   ./run-live-tests.sh                     # curated list, all modes, HTTP+TLS
#   ./run-live-tests.sh v1.0.0 v1.8.2       # explicit tags
#   MODES="bouncer" ./run-live-tests.sh     # only the bouncer scenarios
#   TLS=0 ./run-live-tests.sh               # HTTP only
#   BASE_PORT=29100 BASE_TLS_PORT=29200 ./run-live-tests.sh ...
#
# Modes: both (watcher + bouncer), watcher (JWT only), bouncer (API key only).
# TLS is terminated by an nginx proxy with a temporary self-signed certificate.
#
# Output is streamed: no result file and no per-run log is written.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../../.." && pwd)"
base_port="${BASE_PORT:-29100}"
base_tls_port="${BASE_TLS_PORT:-29200}"
network="${DOCKER_NETWORK:-cs-live-net}"
tls_enabled="${TLS:-1}"
tls_strict="${TLS_STRICT:-1}"
work_dir="$(mktemp -d)"
tls_dir="$work_dir/tls"
containers=()
created_network=""

cleanup() {
    if [[ "${#containers[@]}" -gt 0 ]]; then
        docker rm -f "${containers[@]}" >/dev/null 2>&1 || true
    fi
    if [[ -n "$created_network" ]]; then
        docker network rm "$network" >/dev/null 2>&1 || true
    fi
    rm -rf "$work_dir"
}
trap cleanup EXIT

if [[ "$#" -gt 0 ]]; then
    versions=("$@")
else
    versions=(v1.0.0 v1.2.0 v1.3.0 v1.3.3 v1.4.0 v1.4.2 v1.6.0 v1.6.6 v1.6.9 v1.7.7 v1.8.2)
fi

read -r -a modes <<<"${MODES:-both watcher bouncer}"
for mode in "${modes[@]}"; do
    case "$mode" in
        both | watcher | bouncer) ;;
        *)
            echo "invalid mode '$mode' (expected both, watcher or bouncer)" >&2
            exit 2
            ;;
    esac
done

# The LAPI container always joins this network; TLS only adds the nginx proxy.
if ! docker network inspect "$network" >/dev/null 2>&1; then
    docker network create "$network" >/dev/null
    created_network=1
fi

if [[ "$tls_enabled" = "1" ]]; then
    mkdir -p "$tls_dir"
    openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout "$tls_dir/key.pem" -out "$tls_dir/cert.pem" \
        -days 2 -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1 || {
        echo "failed to generate the TLS certificate" >&2
        exit 2
    }
fi

wait_http() {
    for _ in $(seq 1 90); do
        code=$(curl -s -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true)
        [[ "$code" != "000" ]] && [[ -n "$code" ]] && return 0
        sleep 1
    done
    return 1
}

wait_tls() {
    for _ in $(seq 1 60); do
        code=$(curl -sk -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true)
        [[ "$code" != "000" ]] && [[ -n "$code" ]] && return 0
        sleep 1
    done
    return 1
}

seed_state() {
    docker exec "$name" cscli allowlists create node-live-allowlist -d "node live e2e" >/dev/null 2>&1 || true
    docker exec "$name" cscli allowlists add node-live-allowlist 198.51.100.10 >/dev/null 2>&1 || true

    if docker exec "$name" cscli decisions add --scope Country --value FR --duration 1h --reason node-live-e2e >/dev/null 2>&1; then
        country_seeded="1"
    else
        country_seeded=""
    fi

    docker exec "$name" cscli decisions add --ip 198.18.0.10 --duration 1h --type ban --reason node-live-e2e >/dev/null 2>&1 || true
    docker exec "$name" cscli decisions add --range 198.18.0.0/24 --duration 1h --type ban --reason node-live-e2e >/dev/null 2>&1 || true
    docker exec "$name" cscli decisions add --ip 198.18.0.77 --duration 1h --type ban --reason node-live-e2e >/dev/null 2>&1 || true
    docker exec "$name" cscli decisions add --ip 198.18.0.77 --duration 1h --type captcha --reason node-live-e2e >/dev/null 2>&1 || true
}

run_suite() {
    local mode="$1" url="$2" label="$3" strict="$4" ca="${5:-}"
    local -a envs=(
        CROWDSEC_LIVE=1
        "CROWDSEC_URL=$url"
        "CROWDSEC_API_KEY=$key"
        CROWDSEC_MACHINE_ID=node-live
        "CROWDSEC_PASSWORD=$password"
        "CROWDSEC_LAPI_VERSION=$version"
        "CROWDSEC_MODE=$mode"
        "CROWDSEC_LIVE_ALLOWLIST=node-live-allowlist"
        CROWDSEC_LIVE_ALLOWLIST_IP=198.51.100.10
        "CROWDSEC_LIVE_COUNTRY=$country_seeded"
        "CROWDSEC_STRICT_SSL=$strict"
    )
    [[ -n "$ca" ]] && envs+=("NODE_EXTRA_CA_CERTS=$ca")

    echo "==> $version mode=$mode tls=$label"
    if (
        cd "$repo_root" &&
            env "${envs[@]}" pnpm -F crowdsec-client exec vitest run tests/Live/live.test.ts --reporter=dot
    ); then
        echo "PASS $version mode=$mode tls=$label"
    else
        echo "FAIL $version mode=$mode tls=$label"
        failures=$((failures + 1))
    fi
}

index=0
failures=0

for version in "${versions[@]}"; do
    name="cs-live-test-${version//./-}"
    port=$((base_port + index))
    tls_port=$((base_tls_port + index))
    index=$((index + 1))

    echo "================================================================"
    echo "==> $version (http $port, tls $tls_port)"

    if ! docker run -d --name "$name" --network "$network" -p "127.0.0.1:${port}:8080" \
        -e DISABLE_ONLINE_API=true \
        -e NO_HUB_UPGRADE=true \
        -e USE_WAL=true \
        -e LEVEL_INFO=false \
        -e LEVEL_WARN=true \
        -e DISABLE_AGENT=true \
        -e CROWDSEC_BYPASS_DB_VOLUME_CHECK=true \
        -e NO_HUB_UPDATE=true \
        "crowdsecurity/crowdsec:${version}" >/dev/null; then
        echo "FAIL $version: docker run failed"
        failures=$((failures + 1))
        continue
    fi
    containers+=("$name")

    if ! wait_http "http://127.0.0.1:${port}/health"; then
        echo "FAIL $version: timeout waiting for the LAPI" >&2
        docker logs "$name" 2>&1 | tail -20 >&2 || true
        failures=$((failures + 1))
        continue
    fi

    key=$(docker exec "$name" cscli bouncers add node-live -o raw 2>/dev/null | tr -d '\r\n' || true)
    password="node-live-password"
    docker exec "$name" cscli machines add node-live -p "$password" --force -o raw >/dev/null 2>&1 || true

    if [[ -z "$key" ]]; then
        echo "FAIL $version: bouncer key missing"
        failures=$((failures + 1))
        continue
    fi

    nginx_name="cs-tls-${version//./-}"
    tls_ready=0
    if [[ "$tls_enabled" = "1" ]]; then
        cat >"$tls_dir/nginx.conf" <<EOF
server {
    listen 8443 ssl;
    ssl_certificate /certs/cert.pem;
    ssl_certificate_key /certs/key.pem;
    location / {
        proxy_pass http://${name}:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
        if docker run -d --name "$nginx_name" --network "$network" \
            -p "127.0.0.1:${tls_port}:8443" \
            -v "$tls_dir:/certs:ro" \
            -v "$tls_dir/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
            nginx:alpine >/dev/null && wait_tls "https://127.0.0.1:${tls_port}/health"; then
            tls_ready=1
            containers+=("$nginx_name")
        else
            echo "warning: TLS proxy failed for $version" >&2
            docker logs "$nginx_name" 2>&1 | tail -10 >&2 || true
            docker rm -f "$nginx_name" >/dev/null 2>&1 || true
        fi
    fi

    for mode in "${modes[@]}"; do
        seed_state
        run_suite "$mode" "http://127.0.0.1:${port}" "http" "true"

        if [[ "$tls_ready" -eq 1 ]]; then
            seed_state
            run_suite "$mode" "https://127.0.0.1:${tls_port}" "tls" "false"

            if [[ "$tls_strict" = "1" ]] && [[ "$mode" = "both" ]]; then
                seed_state
                run_suite "$mode" "https://127.0.0.1:${tls_port}" "tls-strict" "true" "$tls_dir/cert.pem"
            fi
        fi
    done

    docker rm -f "$nginx_name" "$name" >/dev/null 2>&1 || true
done

echo "================================================================"
if [[ "$failures" -eq 0 ]]; then
    echo "All live runs passed."
else
    echo "$failures live run(s) failed."
fi
exit "$failures"
