# Compliance and verification

How to check that the project still meets its security and OpenSSF badge
commitments. The policies are the source of truth; this page maps them to
commands and automation.

## Quick verification (local)

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r test
pnpm -r lint
pnpm typecheck
pnpm format:check
pnpm audit --prod --audit-level=high
```

All of these are expected to pass before a pull request is merged.

## Automated enforcement

| Area | Mechanism | Where |
| --- | --- | --- |
| Build, tests, types, lint | CI matrix (4 packages x Node 24 / lts / latest) | `.github/workflows/CI.yml` |
| Static analysis (SAST) | CodeQL `Analyze (javascript)` | `CI.yml`, `codeql.yml` |
| Dependency analysis (SCA) | `pnpm audit --prod` (blocking), OSV-Scanner (report-only) on PR/push, Snyk weekly + release gate (shipped components) | `CI.yml`, `snyk.yml`, `release.yml` |
| Secrets | GitHub secret scanning and push protection | GitHub repository settings |
| Workflow security | actionlint and zizmor | `actions-security.yml` |
| Supply chain | OpenSSF Scorecard | `scorecard.yml` (push and weekly) |
| Releases | Draft-first gate, cosign signature, SLSA provenance, immutable release | `release.yml` |

Current required status checks on `main`:

```bash
gh api repos/thib3113/node-crowdsec/branches/main/protection \
  --jq '.required_status_checks.contexts'
```

## Verifying a release

See [releases.md](./releases.md). Quick check:

```bash
gh attestation verify <asset>.tgz --repo thib3113/node-crowdsec
cosign verify-blob \
  --bundle <asset>.tgz.sigstore \
  --certificate-identity-regexp 'https://github.com/thib3113/node-crowdsec/.github/workflows/release.yml@refs/tags/.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  <asset>.tgz
```

## Periodic verification

- OpenSSF Scorecard runs on every push to `main` and weekly. After a change,
  review Signed-Releases, Token-Permissions, Pinned-Dependencies and
  Branch-Protection.
- The OpenSSF Best Practices badge (metal and Baseline) is re-checked after a
  change to `SECURITY.md`, `GOVERNANCE.md`, `docs/`, the CI workflows or the
  branch protection settings.

## Where each commitment lives

| Topic | Document |
| --- | --- |
| Roles, access, secrets policy | [GOVERNANCE.md](../GOVERNANCE.md) |
| Vulnerability disclosure | [SECURITY.md](../SECURITY.md) |
| Support scope | [SUPPORT.md](../SUPPORT.md) |
| Contribution process and tests | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Component design, attack surface, threat model | [architecture.md](./architecture.md) |
| Dependency and finding policy, VEX | [dependencies.md](./dependencies.md) |
| Release verification | [releases.md](./releases.md) |

## Not-applicable items

Criteria answered N/A are recorded here so they are re-checked when the project
changes.

| Item | Why N/A | Re-check when |
| --- | --- | --- |
| OSPS-QA-04.01 / QA-04.02 (multiple repositories) | Single monorepo | A second repository is added |
| OSPS-BR-01.04 (collaborator input in CI) | No workflow accepts free-form collaborator input | A `workflow_dispatch` input is added |
| OSPS-VM-04.02 (VEX) | No shipped component is affected today (`pnpm audit --prod` is clean) | A runtime advisory is assessed as non-exploitable |
