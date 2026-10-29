# Contributing

Thanks for contributing to node-crowdsec.

## Requirements

- Node.js >= 24
- pnpm >= 12 (the version is pinned in `packageManager`)

## Setup

```bash
git clone https://github.com/thib3113/node-crowdsec.git
cd node-crowdsec
pnpm install
pnpm -r build
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `packages/crowdsec-client` | CrowdSec LAPI client (bouncer + watcher) |
| `packages/crowdsec-http-middleware` | HTTP bouncer/watcher middleware |
| `packages/crowdsec-client-scenarios` | Detection scenarios for the middleware |
| `packages/crowdsec-mcp` | Model Context Protocol server |
| `examples/` | Runnable examples |
| `docs/` | Guides and architecture decision records |

## Common commands

```bash
# build one package
pnpm -F crowdsec-client build

# test one package
pnpm -F crowdsec-client test

# coverage
pnpm -F crowdsec-client test:ci:coverage

# lint
pnpm -F crowdsec-client lint

# run an example
pnpm --filter example-express-bouncer debug
```

Run the tests and lint for every package you touch before opening a pull request.

## Pull requests

- Keep changes focused; one topic per pull request when possible.
- Add or update tests for behavior changes.
- Update the package README and `package.json` metadata when the public API or
  configuration changes.
- Do not commit secrets, tokens or `.env` files.

## Security and conduct

- Report vulnerabilities privately: see [SECURITY.md](./SECURITY.md).
- This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
