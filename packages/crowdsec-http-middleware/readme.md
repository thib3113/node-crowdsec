# crowdsec-http-middleware
[![NPM version](https://img.shields.io/npm/v/crowdsec-http-middleware.svg)](https://www.npmjs.com/package/crowdsec-http-middleware)
[![CI](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml/badge.svg)](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml)
[![codecov](https://codecov.io/gh/thib3113/node-crowdsec/branch/main/graph/badge.svg?token=bQdlb31gcU)](https://codecov.io/gh/thib3113/node-crowdsec)
[![Downloads](https://img.shields.io/npm/dm/crowdsec-http-middleware.svg)](https://www.npmjs.com/package/crowdsec-http-middleware)
[![License](https://img.shields.io/npm/l/crowdsec-http-middleware)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/github/thib3113/node-crowdsec/badge.svg)](https://snyk.io/test/github/thib3113/node-crowdsec)

[//]: # ([![crowdsec-http-middleware-snyk]&#40;https://snyk.io/advisor/npm-package/crowdsec-http-middleware/badge.svg&#41;]&#40;https://snyk.io/advisor/npm-package/crowdsec-http-middleware&#41;)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?logo=paypal)](https://paypal.me/thib3113)
[![GitHub stars](https://img.shields.io/github/stars/thib3113/node-crowdsec.svg?style=social&label=Star)](https://github.com/thib3113/node-crowdsec/stargazers/)
[![Package Quality](https://packagequality.com/shield/crowdsec-http-middleware.svg)](https://packagequality.com/#?package=crowdsec-http-middleware)

[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=bugs)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=code_smells)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=ncloc)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=alert_status)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=security_rating)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=sqale_index)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-http-middleware&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-http-middleware)

![Dependencies update - renovate](https://img.shields.io/badge/renovate-enabled-green?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjUgNSAzNzAgMzcwIj48Y2lyY2xlIGN4PSIxODkiIGN5PSIxOTAiIHI9IjE4NCIgZmlsbD0iI2ZlMiIvPjxwYXRoIGZpbGw9IiM4YmIiIGQ9Ik0yNTEgMjU2bC0zOC0zOGExNyAxNyAwIDAxMC0yNGw1Ni01NmMyLTIgMi02IDAtN2wtMjAtMjFhNSA1IDAgMDAtNyAwbC0xMyAxMi05LTggMTMtMTNhMTcgMTcgMCAwMTI0IDBsMjEgMjFjNyA3IDcgMTcgMCAyNGwtNTYgNTdhNSA1IDAgMDAwIDdsMzggMzh6Ii8+PHBhdGggZmlsbD0iI2Q1MSIgZD0iTTMwMCAyODhsLTggOGMtNCA0LTExIDQtMTYgMGwtNDYtNDZjLTUtNS01LTEyIDAtMTZsOC04YzQtNCAxMS00IDE1IDBsNDcgNDdjNCA0IDQgMTEgMCAxNXoiLz48cGF0aCBmaWxsPSIjYjMwIiBkPSJNMjg1IDI1OGw3IDdjNCA0IDQgMTEgMCAxNWwtOCA4Yy00IDQtMTEgNC0xNiAwbC02LTdjNCA1IDExIDUgMTUgMGw4LTdjNC01IDQtMTIgMC0xNnoiLz48cGF0aCBmaWxsPSIjYTMwIiBkPSJNMjkxIDI2NGw4IDhjNCA0IDQgMTEgMCAxNmwtOCA3Yy00IDUtMTEgNS0xNSAwbC05LThjNSA1IDEyIDUgMTYgMGw4LThjNC00IDQtMTEgMC0xNXoiLz48cGF0aCBmaWxsPSIjZTYyIiBkPSJNMjYwIDIzM2wtNC00Yy02LTYtMTctNi0yMyAwLTcgNy03IDE3IDAgMjRsNCA0Yy00LTUtNC0xMSAwLTE2bDgtOGM0LTQgMTEtNCAxNSAweiIvPjxwYXRoIGZpbGw9IiNiNDAiIGQ9Ik0yODQgMzA0Yy00IDAtOC0xLTExLTRsLTQ3LTQ3Yy02LTYtNi0xNiAwLTIybDgtOGM2LTYgMTYtNiAyMiAwbDQ3IDQ2YzYgNyA2IDE3IDAgMjNsLTggOGMtMyAzLTcgNC0xMSA0em0tMzktNzZjLTEgMC0zIDAtNCAybC04IDdjLTIgMy0yIDcgMCA5bDQ3IDQ3YTYgNiAwIDAwOSAwbDctOGMzLTIgMy02IDAtOWwtNDYtNDZjLTItMi0zLTItNS0yeiIvPjxwYXRoIGZpbGw9IiMxY2MiIGQ9Ik0xNTIgMTEzbDE4LTE4IDE4IDE4LTE4IDE4em0xLTM1bDE4LTE4IDE4IDE4LTE4IDE4em0tOTAgODlsMTgtMTggMTggMTgtMTggMTh6bTM1LTM2bDE4LTE4IDE4IDE4LTE4IDE4eiIvPjxwYXRoIGZpbGw9IiMxZGQiIGQ9Ik0xMzQgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em0tMzUgMzZsMTgtMTggMTggMTgtMTggMTh6Ii8+PHBhdGggZmlsbD0iIzJiYiIgZD0iTTExNiAxNDlsMTgtMTggMTggMTgtMTggMTh6bTU0LTU0bDE4LTE4IDE4IDE4LTE4IDE4em0tODkgOTBsMTgtMTggMTggMTgtMTggMTh6bTEzOS04NWwyMyAyM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTI0LTI0Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS01IDEyLTUgMTYgMHoiLz48cGF0aCBmaWxsPSIjM2VlIiBkPSJNMTM0IDk1bDE4LTE4IDE4IDE4LTE4IDE4em0tNTQgMThsMTgtMTcgMTggMTctMTggMTh6bTU1LTUzbDE4LTE4IDE4IDE4LTE4IDE4em05MyA0OGwtOC04Yy00LTUtMTEtNS0xNiAwTDEwMyAyMDFjLTQgNC00IDExIDAgMTVsOCA4Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS00IDEyLTQgMTYgMHoiLz48cGF0aCBmaWxsPSIjOWVlIiBkPSJNMjcgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em01NC01M2wxOC0xOCAxOCAxOC0xOCAxOHoiLz48cGF0aCBmaWxsPSIjMGFhIiBkPSJNMjMwIDExMGwxMyAxM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTEzLTEzYzQgNCAxMSA0IDE1IDBsMTAxLTEwMWM1LTUgNS0xMSAwLTE2eiIvPjxwYXRoIGZpbGw9IiMxYWIiIGQ9Ik0xMzQgMjQ4Yy00IDAtOC0yLTExLTVsLTIzLTIzYTE2IDE2IDAgMDEwLTIzTDIwMSA5NmExNiAxNiAwIDAxMjIgMGwyNCAyNGM2IDYgNiAxNiAwIDIyTDE0NiAyNDNjLTMgMy03IDUtMTIgNXptNzgtMTQ3bC00IDItMTAxIDEwMWE2IDYgMCAwMDAgOWwyMyAyM2E2IDYgMCAwMDkgMGwxMDEtMTAxYTYgNiAwIDAwMC05bC0yNC0yMy00LTJ6Ii8+PC9zdmc+
)


[![NPM](https://nodei.co/npm/crowdsec-http-middleware.png)](https://nodei.co/npm/crowdsec-http-middleware/)

This library is a Node.js client to talk with crowdsec rest API .
## Start

install it

```
npm i crowdsec-http-middleware
```

and then read the documentation in the [wiki](https://github.com/thib3113/node-crowdsec/wiki)


This package, support a default setup, with default scenarios .
You can use the default mode by installing crowdsec-http-middleware and crowdsec-client-scenarios, and passing an empty `scenarios` configuration

```
npm i crowdsec-http-middleware crowdsec-client-scenarios
```

you can read what are the default scenarios enabled in [crowdsec-client-scenarios](../crowdsec-client-scenarios#defaults-scenarios)

## Usage

This package, is a base package to create HTTP Middleware for HTTP Servers

You can use it like :
````typescript
import * as http from 'http';
import { CrowdSecHTTPMiddleware } from 'crowdsec-http-middleware';

// init the middleware (we will see the options later)
const middleware = new CrowdSecHTTPMiddleware(middlewareOptions);
//wait async stuff like connection to crowdsec LAPI
await middleware.start();

const server = http.createServer((req: IncomingMessage & { ip?: string; decision?: Decision }, res: ServerResponse) => {
    try {
        middleware.getMiddleware()(req, res);
    } catch (e) {
        console.error('middleware error', e);
    }

    if (!req.decision) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!');
        return;
    }

    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`You can't access this api, because you are : ${req.decision?.type}`);
});

const port: number = 3000;
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
````

### options

options are described here : [technical documentation](https://thib3113.github.io/node-crowdsec/interfaces/crowdsec_http_middleware.ICrowdSecHTTPMiddlewareOptions.html)

First the global options
````typescript
const middlewareOptions: ICrowdSecHTTPMiddlewareOptions = {
    // this is the url of the crowdsec instances
    url: process.env.CROWDSEC_URL,
    // options to pass to the crowdsec-client
    clientOptions: {
        // for example, to disable ssl certificate verification
        strictSSL: false
    },
    // here, an optional function to extract Ip from request
    // you can also use a scenario with "extractIp" capability
    // getCurrentIp is prior to scenarios extractIp . If you want to use a default function, create a scenario with only extractIp
    getCurrentIp: (req: IncomingMessage) => req.socket.remoteAddress || '0.0.0.0',
    //we will see this configurations later
    watcher: watcherOptions,
    bouncer: bouncerOptions
}
````

#### Watcher options
the watcher options allow you to setup an optional watcher .
The watcher, will connect with crowdsec LAPI, and run scenarios to send alerts when analyzing requests

you need to remember, that crowdSec is an [IDS](https://en.wikipedia.org/wiki/Intrusion_detection_system), it will detect the alert and block it __the next time__

about authentication, you can also use TLS certificates . Check the [wiki](https://github.com/thib3113/node-crowdsec/wiki/Authentications)
````typescript
const watcherOptions = {
    machineID: 'myMachine',
    password: 'myPassword',
    // send heartbeat to LAPI ? it allow the LAPI to see the watcher "online"
    heartbeat: true,
    // a list of scenarios constructors that will be used
    scenarios: [],
    // options passed to the scenarions
    scenariosOptions: {}
}
````

you can read more about scenarios and scenarioOptions in [the crowdsec-client-scenario package](../crowdsec-client-scenarios)

#### Bouncer options
bouncer, will check if a decision is associated with the current IP .

about authentication, you can also use TLS certificates . Check the [wiki](https://github.com/thib3113/node-crowdsec/wiki/Authentications)
````typescript
const bouncerOptions = {
    apiKey: process.env.CROWDSEC_API_KEY || ''
}
````

When a decision is found by the bouncer, `req.decision` will contain the decision

## Debug
this library include [debug](https://www.npmjs.com/package/debug), to debug, you can set the env variable :
````dotenv
DEBUG=crowdsec-http-middleware:*
````
