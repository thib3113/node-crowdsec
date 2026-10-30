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
