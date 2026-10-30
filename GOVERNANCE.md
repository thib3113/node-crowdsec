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
