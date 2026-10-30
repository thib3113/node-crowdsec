# Verifying releases

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
