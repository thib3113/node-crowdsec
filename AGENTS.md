# AGENTS.md

Guidance for AI agents working in this repository. The policy documents under
`docs/`, `GOVERNANCE.md`, `SECURITY.md` and `CONTRIBUTING.md` are the source of
truth; this file says what to run and where to look.

## Repository map

- `packages/crowdsec-client` — CrowdSec LAPI client (bouncer and watcher).
- `packages/crowdsec-http-middleware` — HTTP middleware, scenarios, `IpDecisionDB`.
- `packages/crowdsec-client-scenarios` — detection scenarios.
- `packages/crowdsec-mcp` — MCP server (alerts, decisions, allowlists).
- `docs/` — `architecture.md` (design and threat model), `dependencies.md`
  (dependency and finding policy), `releases.md` (release verification).
- `GOVERNANCE.md`, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md` — governance,
  security, support and contribution rules.
- `.github/workflows/` — CI, CodeQL, release, Docker and end-to-end tests.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r test
pnpm -r lint
pnpm typecheck
pnpm format:check
pnpm audit --prod --audit-level=high
```

## Before opening a pull request

- [ ] `pnpm -r build`, `pnpm -r test`, `pnpm -r lint`, `pnpm typecheck`,
      `pnpm format:check`
- [ ] `pnpm audit --prod --audit-level=high`
- [ ] no secret, token, `.env` or credential in the diff
- [ ] tests added or updated for behavior changes
- [ ] README and docs updated when the public API or configuration changes
- [ ] `package.json` metadata updated when the public API changes

## Security rules

- Never commit secrets or credentials. If a value is not needed in the
  repository, leave it out. If it is needed at run time, it is supplied by the
  environment at run time and never hardcoded.
- New runtime dependencies must be compatible with the MIT license and pass the
  audit.
- A real but non-exploitable runtime advisory is recorded as one temporary
  OpenVEX statement in `security/openvex.json` (see `docs/dependencies.md`) and
  removed once the dependency is upgraded. There is no standing VEX feed.
- Do not weaken CI: no `--no-verify`, no skipped tests, no `continue-on-error`
  on security checks.

## Releases

- Publish only through `.github/workflows/release.yml`, which signs the tarball
  with cosign and attaches SLSA provenance. Do not publish manually.
- Release assets must be attached to the GitHub release by the workflow.

## Keep in sync

- `docs/architecture.md` — components, actors, attack surface, threat model.
- `docs/dependencies.md` — dependency, SCA/SAST thresholds, VEX.
- `docs/releases.md` — how to verify a release.
- `GOVERNANCE.md` — maintainers, roles, access.
- `docs/compliance.md` — how compliance is verified.
