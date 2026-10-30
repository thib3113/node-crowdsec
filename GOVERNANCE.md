# Governance

## Maintainer

| Name | GitHub | Role |
| --- | --- | --- |
| Thibaut SEVERAC | [@thib3113](https://github.com/thib3113) | Maintainer |

## Roles and responsibilities

- **Maintainer** — reviews and merges pull requests, cuts releases, publishes
  packages, manages the repository and CI settings, holds access to secrets and
  release credentials, and handles security reports. Accountable for the
  project's technical direction and for keeping this document current.
- **Contributor** — anyone who opens an issue or a pull request. Contributors
  have no privileged access: they get read access to the repository and write
  access to their own fork or branch.
- **Security reporter** — anyone reporting a vulnerability through the private
  channel described in [SECURITY.md](./SECURITY.md).

## Access to sensitive resources

Access is granted manually and by least privilege; there is no automatic
escalation.

| Resource | Who has access | How it is protected |
| --- | --- | --- |
| GitHub repository (admin, branch protection, workflows) | Maintainer | GitHub account with 2FA; branch protection and rulesets |
| npm publication of the `crowdsec-*` packages | GitHub Actions via trusted publishing (OIDC) | No long-lived npm token; provenance on every publish |
| Container registries (GHCR, Docker Hub) | GitHub Actions via repository secrets | Secrets stored in GitHub Actions secrets and never committed |
| CI secrets (`CODECOV_TOKEN`, `SNYK_TOKEN`, Docker Hub credentials) | GitHub Actions | Repository secrets, masked in logs |
| Private vulnerability reports | Maintainer | GitHub private vulnerability reporting plus email |

The maintainer is the only person with elevated access. If additional
maintainers are added, this file and the access table are updated in the same
pull request, and access is granted only after review.

## Decision making

Changes are proposed through pull requests and discussed in issues. The
maintainer reviews and merges. Security-sensitive changes follow
[SECURITY.md](./SECURITY.md).

## Secrets management

- No secret is committed to the repository; secret scanning and push protection
  are enabled.
- CI credentials are supplied at run time by the environment (currently GitHub
  Actions secrets such as `CODECOV_TOKEN`, `SNYK_TOKEN` and Docker Hub
  credentials); they are never printed or committed.
- npm uses trusted publishing (OIDC), so no long-lived npm token exists.
- Access is limited to the maintainer and to the CI jobs that need it.
- A credential is rotated immediately if it is exposed, and revoked when a
  maintainer leaves; the new value is provided to CI at run time.

## Review before elevated access

Elevated access (write/merge, secrets, release credentials, repository admin) is
never granted automatically. It is granted manually by the maintainer after a
pull request or issue states the reason, and the access table above is updated
in the same change. Contributors otherwise get read access to the repository and
write access to their own branch or fork only.
