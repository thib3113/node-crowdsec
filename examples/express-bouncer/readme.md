# express-bouncer

A minimal Express server protected by the `crowdsec-client` bouncer. It streams
decisions from the CrowdSec LAPI and rejects banned IPs.

## Requirements

- Node.js >= 24
- A CrowdSec LAPI with a bouncer API key

## Setup

From the repository root:

```bash
pnpm install
pnpm --filter example-express-bouncer debug
```

Or from this directory:

```bash
pnpm debug
```

## Environment

Create a `.env` file (or export the variables) with:

```dotenv
CROWDSEC_URL=http://localhost:8080
CROWDSEC_API_KEY=your-bouncer-key
```

The example also injects a fake `127.0.0.1` ban (`ENABLE_FAKE_DECISION` in
`src/index.ts`) so you can test without a real decision. The server listens on
`http://127.0.0.1:3000`.

## What it shows

- creating and logging in a `BouncerClient`
- consuming `client.Decisions.getStream()`
- rejecting a request when its IP has a decision
