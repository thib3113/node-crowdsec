/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import { AllMetrics, SuccessResponse } from './data-contracts.js';

export namespace UsageMetrics {
    /**
     * @description Post usage metrics from a LP or a bouncer
     * @tags Remediation component, watchers
     * @name UsageMetrics
     * @summary Send usage metrics
     * @request POST:/usage-metrics
     * @secure
     */
    export namespace UsageMetrics {
        export type RequestParams = {};
        export type RequestQuery = {};
        export type RequestBody = AllMetrics;
        export type RequestHeaders = {};
        export type ResponseBody = SuccessResponse;
    }
}
