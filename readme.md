# node-crowdsec
[![CI](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml/badge.svg)](https://github.com/thib3113/node-crowdsec/actions/workflows/CI.yml)
[![codecov](https://codecov.io/gh/thib3113/node-crowdsec/branch/main/graph/badge.svg?token=bQdlb31gcU)](https://codecov.io/gh/thib3113/node-crowdsec)
[![Known Vulnerabilities](https://snyk.io/test/github/thib3113/node-crowdsec/badge.svg)](https://snyk.io/test/github/thib3113/node-crowdsec)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?logo=paypal)](https://paypal.me/thib3113)
[![GitHub stars](https://img.shields.io/github/stars/thib3113/node-crowdsec.svg?style=social&label=Star)](https://github.com/thib3113/node-crowdsec/stargazers/)
[![crowdsec-client-snyk](https://snyk.io/test/github/thib3113/node-crowdsec/badge.svg)](https://snyk.io/test/github/thib3113/node-crowdsec)

[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=bugs)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=code_smells)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=ncloc)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=alert_status)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=security_rating)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=sqale_index)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=thib3113_node-crowdsec&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=thib3113_node-crowdsec)

![Dependencies update - renovate](https://img.shields.io/badge/renovate-enabled-green?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjUgNSAzNzAgMzcwIj48Y2lyY2xlIGN4PSIxODkiIGN5PSIxOTAiIHI9IjE4NCIgZmlsbD0iI2ZlMiIvPjxwYXRoIGZpbGw9IiM4YmIiIGQ9Ik0yNTEgMjU2bC0zOC0zOGExNyAxNyAwIDAxMC0yNGw1Ni01NmMyLTIgMi02IDAtN2wtMjAtMjFhNSA1IDAgMDAtNyAwbC0xMyAxMi05LTggMTMtMTNhMTcgMTcgMCAwMTI0IDBsMjEgMjFjNyA3IDcgMTcgMCAyNGwtNTYgNTdhNSA1IDAgMDAwIDdsMzggMzh6Ii8+PHBhdGggZmlsbD0iI2Q1MSIgZD0iTTMwMCAyODhsLTggOGMtNCA0LTExIDQtMTYgMGwtNDYtNDZjLTUtNS01LTEyIDAtMTZsOC04YzQtNCAxMS00IDE1IDBsNDcgNDdjNCA0IDQgMTEgMCAxNXoiLz48cGF0aCBmaWxsPSIjYjMwIiBkPSJNMjg1IDI1OGw3IDdjNCA0IDQgMTEgMCAxNWwtOCA4Yy00IDQtMTEgNC0xNiAwbC02LTdjNCA1IDExIDUgMTUgMGw4LTdjNC01IDQtMTIgMC0xNnoiLz48cGF0aCBmaWxsPSIjYTMwIiBkPSJNMjkxIDI2NGw4IDhjNCA0IDQgMTEgMCAxNmwtOCA3Yy00IDUtMTEgNS0xNSAwbC05LThjNSA1IDEyIDUgMTYgMGw4LThjNC00IDQtMTEgMC0xNXoiLz48cGF0aCBmaWxsPSIjZTYyIiBkPSJNMjYwIDIzM2wtNC00Yy02LTYtMTctNi0yMyAwLTcgNy03IDE3IDAgMjRsNCA0Yy00LTUtNC0xMSAwLTE2bDgtOGM0LTQgMTEtNCAxNSAweiIvPjxwYXRoIGZpbGw9IiNiNDAiIGQ9Ik0yODQgMzA0Yy00IDAtOC0xLTExLTRsLTQ3LTQ3Yy02LTYtNi0xNiAwLTIybDgtOGM2LTYgMTYtNiAyMiAwbDQ3IDQ2YzYgNyA2IDE3IDAgMjNsLTggOGMtMyAzLTcgNC0xMSA0em0tMzktNzZjLTEgMC0zIDAtNCAybC04IDdjLTIgMy0yIDcgMCA5bDQ3IDQ3YTYgNiAwIDAwOSAwbDctOGMzLTIgMy02IDAtOWwtNDYtNDZjLTItMi0zLTItNS0yeiIvPjxwYXRoIGZpbGw9IiMxY2MiIGQ9Ik0xNTIgMTEzbDE4LTE4IDE4IDE4LTE4IDE4em0xLTM1bDE4LTE4IDE4IDE4LTE4IDE4em0tOTAgODlsMTgtMTggMTggMTgtMTggMTh6bTM1LTM2bDE4LTE4IDE4IDE4LTE4IDE4eiIvPjxwYXRoIGZpbGw9IiMxZGQiIGQ9Ik0xMzQgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em0tMzUgMzZsMTgtMTggMTggMTgtMTggMTh6Ii8+PHBhdGggZmlsbD0iIzJiYiIgZD0iTTExNiAxNDlsMTgtMTggMTggMTgtMTggMTh6bTU0LTU0bDE4LTE4IDE4IDE4LTE4IDE4em0tODkgOTBsMTgtMTggMTggMTgtMTggMTh6bTEzOS04NWwyMyAyM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTI0LTI0Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS01IDEyLTUgMTYgMHoiLz48cGF0aCBmaWxsPSIjM2VlIiBkPSJNMTM0IDk1bDE4LTE4IDE4IDE4LTE4IDE4em0tNTQgMThsMTgtMTcgMTggMTctMTggMTh6bTU1LTUzbDE4LTE4IDE4IDE4LTE4IDE4em05MyA0OGwtOC04Yy00LTUtMTEtNS0xNiAwTDEwMyAyMDFjLTQgNC00IDExIDAgMTVsOCA4Yy00LTQtNC0xMSAwLTE1bDEwMS0xMDFjNS00IDEyLTQgMTYgMHoiLz48cGF0aCBmaWxsPSIjOWVlIiBkPSJNMjcgMTMxbDE4LTE4IDE4IDE4LTE4IDE4em01NC01M2wxOC0xOCAxOCAxOC0xOCAxOHoiLz48cGF0aCBmaWxsPSIjMGFhIiBkPSJNMjMwIDExMGwxMyAxM2M0IDQgNCAxMSAwIDE2TDE0MiAyNDBjLTQgNC0xMSA0LTE1IDBsLTEzLTEzYzQgNCAxMSA0IDE1IDBsMTAxLTEwMWM1LTUgNS0xMSAwLTE2eiIvPjxwYXRoIGZpbGw9IiMxYWIiIGQ9Ik0xMzQgMjQ4Yy00IDAtOC0yLTExLTVsLTIzLTIzYTE2IDE2IDAgMDEwLTIzTDIwMSA5NmExNiAxNiAwIDAxMjIgMGwyNCAyNGM2IDYgNiAxNiAwIDIyTDE0NiAyNDNjLTMgMy03IDUtMTIgNXptNzgtMTQ3bC00IDItMTAxIDEwMWE2IDYgMCAwMDAgOWwyMyAyM2E2IDYgMCAwMDkgMGwxMDEtMTAxYTYgNiAwIDAwMC05bC0yNC0yMy00LTJ6Ii8+PC9zdmc+
)


This repository will host multiples packages, you can found them with examples below

Technical documentation is available [here](https://thib3113.github.io/node-crowdsec/)

## Packages

### [crowdsec-client](./packages/crowdsec-client)

[![NPM version](https://img.shields.io/npm/v/crowdsec-client.svg)](https://www.npmjs.com/package/crowdsec-client)
[![Downloads](https://img.shields.io/npm/dm/crowdsec-client.svg)](https://www.npmjs.com/package/crowdsec-client)
[![License](https://img.shields.io/npm/l/crowdsec-client)](https://github.com/thib3113/node-crowdsec/blob/main/LICENSE)
[![crowdsec-client-snyk](https://snyk.io/advisor/npm-package/crowdsec-client/badge.svg)](https://snyk.io/advisor/npm-package/crowdsec-client)
[![Package Quality](https://packagequality.com/shield/crowdsec-client.svg)](https://packagequality.com/#?package=crowdsec-client)
[![NPM](https://nodei.co/npm/crowdsec-client.png)](https://nodei.co/npm/crowdsec-client/)

a client allowing to talk with the crowdsec API, and so to create your bouncers or watchers

## Examples
 - [express-bouncer](./examples/express-bouncer) : an example of use of the [crowdsec-client](./packages/crowdsec-client) to create an express bouncer
 - [express-bouncer-cjs](./examples/express-bouncer-cjs) : the same as [express-bouncer](./examples/express-bouncer), but wrote in (common) js only

This library is a Node.js client to talk with crowdsec rest API .
