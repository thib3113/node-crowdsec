# express-web-parser

A watcher example: an Express server that reports an alert to CrowdSec when it
sees a known bad user-agent.

## Requirements

- Node.js >= 24
- A CrowdSec LAPI with a watcher machine ID and password

## Setup

From the repository root:

```bash
pnpm install
pnpm --filter example-express-web-parser debug
```

Or from this directory:

```bash
pnpm debug
```

## Environment

The example reads the `.env` file at the repository root (`../../.env`). Set:

```dotenv
CROWDSEC_URL=http://localhost:8080
CROWDSEC_MACHINE_ID=your-machine-id
CROWDSEC_PASSWORD=your-password
```

The server listens on `http://127.0.0.1:3000`.

## What it shows

- creating and logging in a `WatcherClient`
- pushing an alert with `client.Alerts.pushAlerts()`
- matching a request user-agent against `src/badUserAgents.ts`
