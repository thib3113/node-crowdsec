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

import { WatcherAuthRequest, WatcherAuthResponse, WatcherRegistrationRequest } from './data-contracts';

export namespace Watchers {
    /**
     * @description This method is used when installing crowdsec (cscli->APIL)
     * @tags watchers
     * @name RegisterWatcher
     * @summary RegisterWatcher
     * @request POST:/watchers
     */
    export namespace RegisterWatcher {
        export type RequestParams = {};
        export type RequestQuery = {};
        export type RequestBody = WatcherRegistrationRequest;
        export type RequestHeaders = {};
        export type ResponseBody = void;
    }

    /**
     * @description Authenticate current to get session ID
     * @tags watchers
     * @name AuthenticateWatcher
     * @summary AuthenticateWatcher
     * @request POST:/watchers/login
     */
    export namespace AuthenticateWatcher {
        export type RequestParams = {};
        export type RequestQuery = {};
        export type RequestBody = WatcherAuthRequest;
        export type RequestHeaders = {};
        export type ResponseBody = WatcherAuthResponse;
    }
}
