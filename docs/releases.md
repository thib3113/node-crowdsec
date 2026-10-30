# Verifying releases

## Cutting a release

Releases are draft-first and gated: the tag is created by the workflow only
after CI and the Snyk gate pass.

1. Bump the version in the package's `package.json` and merge it to `main`.
2. Create a **draft** release whose tag is `<package>/v<version>`
   (e.g. `crowdsec-mcp/v0.0.7`), with the release notes.
3. Trigger the workflow (no input: it picks up the single open draft):

   ```bash
   gh workflow run release.yml --ref main
   gh run watch
   ```

The run validates the tag against `package.json`, runs CI and the Snyk gate,
builds and signs the artifacts, attaches them to the draft, publishes the npm
packages, then publishes the draft. The tag is created at that last step, so a
failure leaves a deletable draft and a **reusable tag name**. Delete it and retry:

```bash
gh api -X DELETE repos/thib3113/node-crowdsec/releases/<draft-id>
```

GitHub does not trigger workflows when a draft release is created (`created`,
`edited` and `deleted` are not delivered for drafts), hence the manual trigger.

Tag creation is restricted by a repository ruleset to the GitHub Actions app, so
a published release cannot be created by hand with a new tag; the workflow is
the only path.

## Published assets

Every release is published from CI. A release page contains:

- the npm tarball, e.g. `crowdsec-mcp-0.0.6.tgz`;
- its keyless cosign signature, `crowdsec-mcp-0.0.6.tgz.sigstore`;
- its SLSA build provenance, `crowdsec-mcp-0.0.6.tgz.intoto.jsonl`.

Container images are published separately with build provenance and an SBOM;
see the image documentation for their digests.

## Integrity

The tarball hash can be checked against the digest recorded by npm:

```bash
sha256sum crowdsec-mcp-0.0.6.tgz
npm view crowdsec-mcp@0.0.6 dist.integrity
```

For an installed dependency set, `npm audit signatures` verifies the registry
signatures and the published provenance.

## Authenticity and author identity

The signature is keyless: it is backed by the GitHub Actions OIDC identity of the
release workflow. Verify it with cosign, checking both the certificate identity
(workflow and tag) and the issuer:

```bash
cosign verify-blob \
  --bundle crowdsec-mcp-0.0.6.tgz.sigstore \
  --certificate-identity-regexp 'https://github.com/thib3113/node-crowdsec/.github/workflows/release.yml@refs/tags/.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  crowdsec-mcp-0.0.6.tgz
```

The SLSA provenance records the same identity and the commit that produced the
artifact:

```bash
gh attestation verify crowdsec-mcp-0.0.6.tgz \
  --repo thib3113/node-crowdsec
```

`gh attestation verify` prints the repository, workflow, commit and tag that
signed the artifact. A valid signature from the expected workflow and tag means
the release was produced by the project's release pipeline and not modified
afterwards.
