# express-bouncer-cjs

The same as [express-bouncer](../express-bouncer), written in CommonJS instead of
ESM. It shows a `crowdsec-client` bouncer protecting an Express server.

## Requirements

- Node.js >= 24
- A CrowdSec LAPI with a bouncer API key

## Setup

From the repository root:

```bash
pnpm install
pnpm --filter example-express-bouncer-cjs start
```

Or from this directory:

```bash
pnpm start
```

## Environment

Create a `.env` file (or export the variables) with:

```dotenv
CROWDSEC_URL=http://localhost:8080
CROWDSEC_API_KEY=your-bouncer-key
```

The example also injects a fake `127.0.0.1` ban (`ENABLE_FAKE_DECISION` in
`src/index.js`) so you can test without a real decision. The server listens on
`http://127.0.0.1:3000`.

## What it shows

- the same bouncer flow as `express-bouncer`, without `"type": "module"`
- `require('crowdsec-client')` instead of ESM imports
