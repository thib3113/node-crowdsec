# Dependency management

This document explains how the project selects, obtains and tracks its
dependencies.

## Selection

- Prefer a small dependency tree; implement small utilities locally when that
  is cheaper than adding a package.
- Prefer actively maintained packages with a licence compatible with MIT
  (MIT, ISC, Apache-2.0, BSD). Copyleft licences such as GPL or AGPL are not
  accepted.
- Prefer pure-JavaScript packages so CI and the Docker image do not need a
  native toolchain.
- Runtime dependencies go in each package's `dependencies`; tooling used only
  for development or tests goes in `devDependencies`.

## Obtaining and building

- pnpm is the only package manager (pinned through the `packageManager` field,
  pnpm >= 12).
- `pnpm-lock.yaml` is committed. CI installs with
  `pnpm install --frozen-lockfile`, and any dependency change must include the
  matching lockfile update.
- Node.js >= 24 is required (see the `engines` field).
- Builds use esbuild and TypeScript and emit to `dist/`; build output is not
  committed.

## Tracking and updating

- [Renovate](https://docs.renovatebot.com/) keeps dependencies and GitHub
  Actions up to date. Its configuration (`renovate.json`) enables vulnerability
  alerts, pins GitHub Actions and Docker images by digest, waits for a
  three-day release age before proposing an update, and automerges minor and
  patch updates of stable dependencies once CI passes.
- The Renovate dependency dashboard lists pending updates and blocked PRs.
- `pnpm audit --prod` is expected to be clean for runtime dependencies, and CI
  runs Snyk, CodeQL and SonarCloud on changes.
- Dependency updates land as pull requests that must pass the required CI
  check before merging, so every update is reviewed and tested.

## Licence compliance

Every new dependency is checked against its SPDX licence identifier. A
dependency whose licence is incompatible with the project's MIT licence is not
accepted.

## Security findings

Dependencies and code are checked continuously (`pnpm audit`, Snyk, CodeQL,
SonarCloud, and Renovate vulnerability alerts). Findings are triaged and
remediated using these thresholds:

| Severity | SCA (dependencies) | SAST (code) |
| --- | --- | --- |
| Critical | fix or mitigate before the next release | fix before merge |
| High | fix before the next release | fix before merge, or document as a false positive |
| Medium | within 90 days | within 90 days |
| Low | best effort | best effort |

A release is not cut while a critical or high finding is open for a shipped
component. Findings that cannot be fixed immediately are documented (see below)
rather than silently ignored.

## Vulnerability triage and VEX

The default action is to update the dependency through Renovate. A VEX document
is only needed for a **runtime** advisory that is real but **not exploitable** in
this project and cannot be fixed immediately. It is deliberately lightweight:

1. Create `security/openvex.json` the first time such a case appears.
2. Add one OpenVEX statement per advisory with the reason
   (`component_not_present`, `vulnerable_code_not_present`,
   `vulnerable_code_not_in_execute_path`,
   `vulnerable_code_cannot_be_controlled_by_adversary`,
   `inline_mitigations_already_exist`) and a review date.
3. Delete the statement once the dependency is upgraded past the fix.

There is no standing VEX feed and no per-release work: if the file does not
exist, there is nothing to maintain. Dev-only advisories are out of scope because
they are not shipped.
