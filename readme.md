# node-crowdsec

[![CI](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml/badge.svg)](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/thib3113/node-crowdsec/badge)](https://securityscorecards.dev/viewer/?uri=github.com/thib3113/node-crowdsec)
[![codecov](https://codecov.io/gh/thib3113/node-crowdsec/branch/main/graph/badge.svg?token=bQdlb31gcU)](https://codecov.io/gh/thib3113/node-crowdsec)
[![Known Vulnerabilities](https://snyk.io/test/github/thib3113/node-crowdsec/badge.svg)](https://snyk.io/test/github/thib3113/node-crowdsec)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?logo=paypal)](https://paypal.me/thib3113)
[![GitHub stars](https://img.shields.io/github/stars/thib3113/node-crowdsec.svg?style=social&label=Star)](https://github.com/thib3113/node-crowdsec/stargazers/)

![Dependencies update - renovate](https://img.shields.io/badge/renovate-enabled-green?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjUgNSAzNzAgMzcwIj48Y2lyY2xlIGN4PSIxODkiIGN5PSIxOTAiIHI9IjE4NCIgZmlsbD0iI2ZlMiIvPjxwYXRoIGZpbGw9IiM4YmIiIGQ9Ik0yNTEgMjU2bC0zOC0zOGExNyAxNyAwIDAxMC0yNGw1Ni01NmMyLTIgMi02IDAtN2wtMjAtMjFhNSA1IDAgMDAtNyAwbC0xMyAxMi05LTggMTMtMTNhMTcgMTcgMCAwMTI0IDBsMjEgMjFjNyA3IDcgMTcgMCAyNGwtNTYgNTdhNSA1IDAgMDAwIDdsMzggMzh6Ii8+PHBhdGggZmlsbD0iI2Q1MSIgZD0iTTMwMCAyODhsLTggOGMtNCA0LTExIDQtMTYgMGwtNDYtNDZjLTUtNS01LTEyIDAtMTZsOC04YzQtNCAxMS00IDE1IDBsNDcgNDdjNCA0IDQgMTEgMCAxNXoiLz48cGF0aCBmaWxsPSIjYjMwIiBkPSJNMjg1IDI1OGw3IDdjNCA0IDQgMTEgMCAxNWwtOCA4Yy00IDQtMTEgNC0xNiAwbC02LTdjNCA1IDExIDUgMTUgMGw4LTdjNC01IDQtMTIgMC0xNnoiLz48cGF0aCBmaWxsPSIjYTMwIiBkPSJNMjkxIDI2NGw4IDhjNCA0IDQgMTEgMCAxNmwtOCA3Yy00IDUtMTEgNS0xNSAwbC05LThjNSA1IDEyIDUgMTYgMGw4LThjNC00IDQtMTEgMC0xNXoiLz48cGF0aCBmaWxsPSIjZTYyIiBkPSJNMjYwIDIzM2wtNC00Yy02LTYtMTctNi0yMyAwLTcgNy03IDE3IDAgMjRsNCA0Yy00LTUtNC0xMSAwLTE2bDgtOGM0LTQgMTEtNCAxNSAweiIvPjxwYXRoIGZpbGw9IiNiNDAiIGQ9Ik0yODQgMzA0Yy00IDAtOC0xLTExLTRsLTQ3LTQ3Yy02LTYtNi0xNiAwLTIybDgtOGM2LTYgMTYtNiAyMiAwbDQ3IDQ2YzYgNyA2IDE3IDAgMjNsLTggOGMtMyAzLTcgNC0xMSA0em0tMzktNzZjLTEgMC0zIDAtNCAybC04IDdjLTIgMy0yIDcgMCA5bDQ3IDQ3YTYgNiAwIDAwOSAwbDctOGMzLTIgMy02IDAtOWwtNDYtNDZjLTItMi0zLTItNS0yeiIvPjxwYXRoIGZpbGw9IiMxY2MiIGQ9Ik0xNTIgMTEzbDE4LTE4IDE4IDE4LTE4IDE4em0xLTM1bDE4LTE4IDE4IDE4LTE4IDE4em0tOTAgODlsMTgtMTggMTggMTgtMTggMTh6bTM1LTM2bDE4LTE4IDE4IDE4LTE4IDE4eiIvPjxwYXRoIGZpbGw9IiMxZGQiIGQ9Ik0xMzQgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em0tMzUgMzZsMTgtMTggMTggMTgtMTggMTh6Ii8+PHBhdGggZmlsbD0iIzJiYiIgZD0iTTExNiAxNDlsMTgtMTggMTggMTgtMTggMTh6bTU0LTU0bDE4LTE4IDE4IDE4LTE4IDE4em0tODkgOTBsMTgtMTggMTggMTgtMTggMTh6bTEzOS04NWwyMyAyM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTI0LTI0Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS01IDEyLTUgMTYgMHoiLz48cGF0aCBmaWxsPSIjM2VlIiBkPSJNMTM0IDk1bDE4LTE4IDE4IDE4LTE4IDE4em0tNTQgMThsMTgtMTcgMTggMTctMTggMTh6bTU1LTUzbDE4LTE4IDE4IDE4LTE4IDE4em05MyA0OGwtOC04Yy00LTUtMTEtNS0xNiAwTDEwMyAyMDFjLTQgNC00IDExIDAgMTVsOCA4Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS00IDEyLTQgMTYgMHoiLz48cGF0aCBmaWxsPSIjOWVlIiBkPSJNMjcgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em01NC01M2wxOC0xOCAxOCAxOC0xOCAxOHoiLz48cGF0aCBmaWxsPSIjMGFhIiBkPSJNMjMwIDExMGwxMyAxM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTEzLTEzYzQgNCAxMSA0IDE1IDBsMTAxLTEwMWM1LTUgNS0xMSAwLTE2eiIvPjxwYXRoIGZpbGw9IiMxYWIiIGQ9Ik0xMzQgMjQ4Yy00IDAtOC0yLTExLTVsLTIzLTIzYTE2IDE2IDAgMDEwLTIzTDIwMSA5NmExNiAxNiAwIDAxMjIgMGwyNCAyNGM2IDYgNiAxNiAwIDIyTDE0NiAyNDNjLTMgMy03IDUtMTIgNXptNzgtMTQ3bC00IDItMTAxIDEwMWE2IDYgMCAwMDAgOWwyMyAyM2E2IDYgMCAwMDkgMGwxMDEtMTAxYTYgNiAwIDAwMC05bC0yNC0yMy00LTJ6Ii8+PC9zdmc+
)

This repository hosts several packages, listed below with examples.

The [technical documentation](https://thib3113.github.io/node-crowdsec/) is available online.

For agents and LLM tooling, see [llms.txt](./llms.txt).

## Features

- **Full CrowdSec client** : watcher & bouncer clients for the CrowdSec LAPI
  (alerts, decisions, stream, watcher registration/self-delete...).
- **High-performance bouncer** : decisions are streamed from the LAPI and indexed
  locally by CIDR (numeric prefix lookup). Checking an IP costs ~µs with a
  negligible event loop impact, even with hundreds of thousands of decisions.
- **Live mode** (optional) : unknown IPs are checked against the LAPI in the
  background, closing the freshness gap of the stream poll. A malicious unknown
  IP passes at most once.
- **Configurable trust scope** : `subnetLevel` lets you choose how far up the
  prefix hierarchy to consider as malicious (`resident` / `company` / `country`),
  so a whole country block is never banned by accident.
- **Watcher scenarios** : bundled scenarios (user-agent, ip-extraction...) to
  detect and alert on malicious requests, with a pluggable scenario system.
- **MCP server** : expose decisions, alerts and allowlists to an LLM through the
  Model Context Protocol, read-only by default.

## Packages

### [crowdsec-client](./packages/crowdsec-client)

[![NPM version](https://img.shields.io/npm/v/crowdsec-client.svg)](https://www.npmjs.com/package/crowdsec-client)
[![Downloads](https://img.shields.io/npm/dm/crowdsec-client.svg)](https://www.npmjs.com/package/crowdsec-client)
[![License](https://img.shields.io/npm/l/crowdsec-client)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![Package Quality](https://packagequality.com/shield/crowdsec-client.svg)](https://packagequality.com/#?package=crowdsec-client)

[//]: # ([![crowdsec-client-snyk]&#40;https://snyk.io/advisor/npm-package/crowdsec-client/badge.svg&#41;]&#40;https://snyk.io/advisor/npm-package/crowdsec-client&#41;)
[![NPM](https://nodei.co/npm/crowdsec-client.png?months=3&height=1)](https://nodei.co/npm/crowdsec-client/)

### [crowdsec-http-middleware](./packages/crowdsec-http-middleware)

[![NPM version](https://img.shields.io/npm/v/crowdsec-http-middleware.svg)](https://www.npmjs.com/package/crowdsec-http-middleware)
[![Downloads](https://img.shields.io/npm/dm/crowdsec-http-middleware.svg)](https://www.npmjs.com/package/crowdsec-http-middleware)
[![License](https://img.shields.io/npm/l/crowdsec-http-middleware)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![Package Quality](https://packagequality.com/shield/crowdsec-http-middleware.svg)](https://packagequality.com/#?package=crowdsec-http-middleware)

[//]: # ([![crowdsec-http-middleware-snyk]&#40;https://snyk.io/advisor/npm-package/crowdsec-http-middleware/badge.svg&#41;]&#40;https://snyk.io/advisor/npm-package/crowdsec-http-middleware&#41;)
[![NPM](https://nodei.co/npm/crowdsec-http-middleware.png?months=3&height=1)](https://nodei.co/npm/crowdsec-http-middleware/)

An alpha HTTP middleware that allows you to use CrowdSec to protect your HTTP server.

AI agent setup guide: [docs/agent-setup-guide.md](./docs/agent-setup-guide.md).

### [crowdsec-client-scenarios](./packages/crowdsec-client-scenarios)

[![NPM version](https://img.shields.io/npm/v/crowdsec-client-scenarios.svg)](https://www.npmjs.com/package/crowdsec-client-scenarios)
[![Downloads](https://img.shields.io/npm/dm/crowdsec-client-scenarios.svg)](https://www.npmjs.com/package/crowdsec-client-scenarios)
[![License](https://img.shields.io/npm/l/crowdsec-client-scenarios)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![Package Quality](https://packagequality.com/shield/crowdsec-client-scenarios.svg)](https://packagequality.com/#?package=crowdsec-client-scenarios)

[//]: # ([![crowdsec-client-scenarios-snyk]&#40;https://snyk.io/advisor/npm-package/crowdsec-client-scenarios/badge.svg&#41;]&#40;https://snyk.io/advisor/npm-package/crowdsec-client-scenarios&#41;)
[![NPM](https://nodei.co/npm/crowdsec-client-scenarios.png?months=3&height=1)](https://nodei.co/npm/crowdsec-client-scenarios/)

Optional scenarios to use with the middleware.

### [crowdsec-mcp](./packages/crowdsec-mcp)

[![CI](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml/badge.svg)](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) server for CrowdSec: exposes decisions, alerts and allowlists to an LLM, with read-only mode by default.

## Examples

- [express-bouncer](./examples/express-bouncer) : an example using [crowdsec-client](./packages/crowdsec-client) to create an Express bouncer
- [express-bouncer-cjs](./examples/express-bouncer-cjs) : the same example written in CommonJS
- [express-web-parser](./examples/express-web-parser) : a watcher example that reports clients using a bad user-agent

This repository provides a Node.js client for the CrowdSec REST API, an HTTP
middleware, detection scenarios and an MCP server. Node.js >= 24 is required.

## Security

Report vulnerabilities privately: see [SECURITY.md](./SECURITY.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE)

## Thanks to

- [Crowdsec team](https://www.crowdsec.net/) for the crowdsec tool
- [University of Delaware](https://www.udel.edu/)
