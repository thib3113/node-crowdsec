# crowdsec-client-scenarios
[![NPM version](https://img.shields.io/npm/v/crowdsec-client-scenarios.svg)](https://www.npmjs.com/package/crowdsec-client-scenarios)
[![CI](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml/badge.svg)](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml)
[![codecov](https://codecov.io/gh/thib3113/node-crowdsec/branch/main/graph/badge.svg?token=bQdlb31gcU)](https://codecov.io/gh/thib3113/node-crowdsec)
[![Downloads](https://img.shields.io/npm/dm/crowdsec-client-scenarios.svg)](https://www.npmjs.com/package/crowdsec-client-scenarios)
[![License](https://img.shields.io/npm/l/crowdsec-client-scenarios)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/github/thib3113/node-crowdsec/badge.svg)](https://snyk.io/test/github/thib3113/node-crowdsec)

[//]: # ([![crowdsec-client-scenarios-snyk]&#40;https://snyk.io/advisor/npm-package/crowdsec-client-scenarios/badge.svg&#41;]&#40;https://snyk.io/advisor/npm-package/crowdsec-client-scenarios&#41;)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?logo=paypal)](https://paypal.me/thib3113)
[![GitHub stars](https://img.shields.io/github/stars/thib3113/node-crowdsec.svg?style=social&label=Star)](https://github.com/thib3113/node-crowdsec/stargazers/)
[![Package Quality](https://packagequality.com/shield/crowdsec-client-scenarios.svg)](https://packagequality.com/#?package=crowdsec-client-scenarios)

[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=bugs)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=code_smells)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=ncloc)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=alert_status)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=security_rating)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=sqale_index)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=thib3113_crowdsec-client-scenarios&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=thib3113_crowdsec-client-scenarios)

![Dependencies update - renovate](https://img.shields.io/badge/renovate-enabled-green?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjUgNSAzNzAgMzcwIj48Y2lyY2xlIGN4PSIxODkiIGN5PSIxOTAiIHI9IjE4NCIgZmlsbD0iI2ZlMiIvPjxwYXRoIGZpbGw9IiM4YmIiIGQ9Ik0yNTEgMjU2bC0zOC0zOGExNyAxNyAwIDAxMC0yNGw1Ni01NmMyLTIgMi02IDAtN2wtMjAtMjFhNSA1IDAgMDAtNyAwbC0xMyAxMi05LTggMTMtMTNhMTcgMTcgMCAwMTI0IDBsMjEgMjFjNyA3IDcgMTcgMCAyNGwtNTYgNTdhNSA1IDAgMDAwIDdsMzggMzh6Ii8+PHBhdGggZmlsbD0iI2Q1MSIgZD0iTTMwMCAyODhsLTggOGMtNCA0LTExIDQtMTYgMGwtNDYtNDZjLTUtNS01LTEyIDAtMTZsOC04YzQtNCAxMS00IDE1IDBsNDcgNDdjNCA0IDQgMTEgMCAxNXoiLz48cGF0aCBmaWxsPSIjYjMwIiBkPSJNMjg1IDI1OGw3IDdjNCA0IDQgMTEgMCAxNWwtOCA4Yy00IDQtMTEgNC0xNiAwbC02LTdjNCA1IDExIDUgMTUgMGw4LTdjNC01IDQtMTIgMC0xNnoiLz48cGF0aCBmaWxsPSIjYTMwIiBkPSJNMjkxIDI2NGw4IDhjNCA0IDQgMTEgMCAxNmwtOCA3Yy00IDUtMTEgNS0xNSAwbC05LThjNSA1IDEyIDUgMTYgMGw4LThjNC00IDQtMTEgMC0xNXoiLz48cGF0aCBmaWxsPSIjZTYyIiBkPSJNMjYwIDIzM2wtNC00Yy02LTYtMTctNi0yMyAwLTcgNy03IDE3IDAgMjRsNCA0Yy00LTUtNC0xMSAwLTE2bDgtOGM0LTQgMTEtNCAxNSAweiIvPjxwYXRoIGZpbGw9IiNiNDAiIGQ9Ik0yODQgMzA0Yy00IDAtOC0xLTExLTRsLTQ3LTQ3Yy02LTYtNi0xNiAwLTIybDgtOGM2LTYgMTYtNiAyMiAwbDQ3IDQ2YzYgNyA2IDE3IDAgMjNsLTggOGMtMyAzLTcgNC0xMSA0em0tMzktNzZjLTEgMC0zIDAtNCAybC04IDdjLTIgMy0yIDcgMCA5bDQ3IDQ3YTYgNiAwIDAwOSAwbDctOGMzLTIgMy02IDAtOWwtNDYtNDZjLTItMi0zLTItNS0yeiIvPjxwYXRoIGZpbGw9IiMxY2MiIGQ9Ik0xNTIgMTEzbDE4LTE4IDE4IDE4LTE4IDE4em0xLTM1bDE4LTE4IDE4IDE4LTE4IDE4em0tOTAgODlsMTgtMTggMTggMTgtMTggMTh6bTM1LTM2bDE4LTE4IDE4IDE4LTE4IDE4eiIvPjxwYXRoIGZpbGw9IiMxZGQiIGQ9Ik0xMzQgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em0tMzUgMzZsMTgtMTggMTggMTgtMTggMTh6Ii8+PHBhdGggZmlsbD0iIzJiYiIgZD0iTTExNiAxNDlsMTgtMTggMTggMTgtMTggMTh6bTU0LTU0bDE4LTE4IDE4IDE4LTE4IDE4em0tODkgOTBsMTgtMTggMTggMTgtMTggMTh6bTEzOS04NWwyMyAyM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTI0LTI0Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS01IDEyLTUgMTYgMHoiLz48cGF0aCBmaWxsPSIjM2VlIiBkPSJNMTM0IDk1bDE4LTE4IDE4IDE4LTE4IDE4em0tNTQgMThsMTgtMTcgMTggMTctMTggMTh6bTU1LTUzbDE4LTE4IDE4IDE4LTE4IDE4em05MyA0OGwtOC04Yy00LTUtMTEtNS0xNiAwTDEwMyAyMDFjLTQgNC00IDExIDAgMTVsOCA4Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS00IDEyLTQgMTYgMHoiLz48cGF0aCBmaWxsPSIjOWVlIiBkPSJNMjcgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em01NC01M2wxOC0xOCAxOCAxOC0xOCAxOHoiLz48cGF0aCBmaWxsPSIjMGFhIiBkPSJNMjMwIDExMGwxMyAxM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTEzLTEzYzQgNCAxMSA0IDE1IDBsMTAxLTEwMWM1LTUgNS0xMSAwLTE2eiIvPjxwYXRoIGZpbGw9IiMxYWIiIGQ9Ik0xMzQgMjQ4Yy00IDAtOC0yLTExLTVsLTIzLTIzYTE2IDE2IDAgMDEwLTIzTDIwMSA5NmExNiAxNiAwIDAxMjIgMGwyNCAyNGM2IDYgNiAxNiAwIDIyTDE0NiAyNDNjLTMgMy03IDUtMTIgNXptNzgtMTQ3bC00IDItMTAxIDEwMWE2IDYgMCAwMDAgOWwyMyAyM2E2IDYgMCAwMDkgMGwxMDEtMTAxYTYgNiAwIDAwMC05bC0yNC0yMy00LTJ6Ii8+PC9zdmc+
)


[![NPM](https://nodei.co/npm/crowdsec-client-scenarios.png)](https://nodei.co/npm/crowdsec-client-scenarios/)

This library is a Node.js client to talk with crowdsec rest API .
# Start

install it

```
npm i crowdsec-client-scenarios
```

and then read the documentation in the [wiki](https://github.com/thib3113/node-crowdsec/wiki)

# Usage

This package, is planned to host scenarios used by [crowdsec-http-middleware](https://www.npmjs.com/package/crowdsec-http-middleware) and other middleware that extend it

# Scenarios

in this part, we will use the variables `scenarios` and `scenariosOptions`, to illustrate the use in the middlewares

## Defaults scenarios
the defaults scenarios are ([defined here](https://github.com/thib3113/node-crowdsec/blob/main/packages/crowdsec-client-scenarios/src/index.ts#L8)) :

- [AllowListEnricher](#allowlist) : allow you to skip alerts on your local ips
- [XForwardedForChecker](#xforwardedforchecker) : allow to extract visitor ip
- [HTTPEnricher](#httpenricher) : enrich alerts with information from the http request

## Available scenarios
The available scenarios are :

### XForwardedForChecker
This scenario will validate the XForwardedFor header . Some malicious persons will send you a fake `X-Forwarded-For` header, to hide their real IP .
This scenario will trigger an alert, if an untrusted IP try to pass `X-Forwarded-For`
````typescript
const scenarios = [XForwardedForChecker];
const scenariosOptions = {
    'x-forwarded-for': {
        //list of trusted CIDR, you need to setup here that all the trusted proxies, else, it will trigger alert for your reverse proxies, and extract incorrect ip
        trustedProxies: [],
        //trigger alert if an untrusted ip set the header (true by default)
        alertOnNotTrustedIps: true
    }
}
````

this scenario support the extractIp capability, so, if you enable it, it will extract the IP automatically from the headers, will use set it on `req.ip`, and will use it to trigger alerts and check if decisions exists

#### Example
you are using cloudflare (you can get cloudflare [ips](https://www.cloudflare.com/fr-fr/ips/) here, then traefik in subnet 10.0.3.0/24, and finally your webserver

on your server, you will configure :
````typescript
const scenarios = [XForwardedForChecker];
const scenariosOptions = {
    'x-forwarded-for': {
        //list of trusted CIDR, you need to setup here that all the trusted proxies, else, it will trigger alert for your reverse proxies, and extract incorrect ip
        trustedProxies: [
            //cloudflare ips
            "173.245.48.0/20",
            "103.21.244.0/22",
            "103.22.200.0/22",
            "103.31.4.0/22",
            "141.101.64.0/18",
            "108.162.192.0/18",
            "190.93.240.0/20",
            "188.114.96.0/20",
            "197.234.240.0/22",
            "198.41.128.0/17",
            "162.158.0.0/15",
            "104.16.0.0/13",
            "104.24.0.0/14",
            "172.64.0.0/13",
            "131.0.72.0/22",
            "2400:cb00::/32",
            "2606:4700::/32",
            "2803:f800::/32",
            "2405:b500::/32",
            "2405:8100::/32",
            "2a06:98c0::/29",
            "2c0f:f248::/32",
            //traefik ip
            "10.0.3.0/24"
        ],
        //trigger alert if an untrusted ip set the header
        alertOnNotTrustedIps: true
    }
}
````

so, if someone with ip `1.2.3.4` it will produce an `X-Forwarded-For` like `1.2.3.4, 173.245.48.2`, and your webserver will detect a remote address like `10.0.3.1` .
This scenario will parse the information, and so set `req.ip = "1.2.3.4"`, so you now know the real ip of your visitor .

I need to warn you, if you miss configured the list of allowed ips, it can ban your reverse proxy .
you can test it before, by setting `alertOnNotTrustedIps` to false, and log `req.ip`, if the IP is correct, you can enable the alerts

### AllowList
This scenario allow you to exclude some ips from alerts
````typescript
const scenarios = [AllowListEnricher];
const scenariosOptions = {
    'allow-list': {
        //list of CIDR/IP to allow to skip alert checks
        allowed: ['127.0.0.1']
    }
}
````

by default, the CIDR allowed are the [RFC 1918](https://en.wikipedia.org/wiki/Private_network) one (private network)
````typescript
const scenariosOptions = {
    'allow-list': {
        allowed: ['127.0.0.1', '::1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']
    }
}
````

### HTTPEnricher

this scenario will add context to your alert, linked with the current http request

````typescript
const scenarios = [AllowListEnricher];
//no options
const scenariosOptions = {}
````

### MaxMindEnricher

this scenario will add context to your alert with the help of the maxmind databases

````typescript
const scenarios = [MaxMindEnricher];
const scenariosOptions = {
    maxmind: {
        //specify path to ASN or city databases . you need need to set one, or the two databases
        paths: {
            ASN: 'path/to/geoLite2-ASN.mmdb',
            city: 'path/to/geoLite2-City.mmdb'
        },
        //you can watch for updates, and so, updating the database on the filesytem will automatically reload the database
        watchForUpdates: true
    }
}
````

to use this scenario, you will need to download free databases available [here](http://dev.maxmind.com/geoip/geoip2/geolite2/).
If you need better accuracy you should consider buying [commercial subscription](https://www.maxmind.com/en/geoip2-databases).

## Debug
this library include [debug](https://www.npmjs.com/package/debug), to debug, you can set the env variable :
````dotenv
DEBUG=crowdsec-client-scenarios:*
````
