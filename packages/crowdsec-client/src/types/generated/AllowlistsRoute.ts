/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import {
    BulkCheckAllowlistRequest,
    BulkCheckAllowlistResponse,
    CheckAllowlistResponse,
    GetAllowlistResponse,
    GetAllowlistsResponse
} from './data-contracts.js';

export namespace Allowlists {
    /**
     * @description Get a list of all allowlists
     * @tags watchers
     * @name GetAllowlists
     * @summary getAllowlists
     * @request GET:/allowlists
     */
    export namespace GetAllowlists {
        export type RequestParams = {};
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = GetAllowlistsResponse;
    }

    /**
     * @description Get a specific allowlist
     * @tags watchers
     * @name GetAllowlist
     * @summary getAllowlist
     * @request GET:/allowlists/{allowlist_name}
     */
    export namespace GetAllowlist {
        export type RequestParams = {
            allowlistName: string;
        };
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = GetAllowlistResponse;
    }

    /**
     * @description Get a specific allowlist
     * @tags watchers
     * @name HeadAllowlist
     * @summary getAllowlist
     * @request HEAD:/allowlists/{allowlist_name}
     */
    export namespace HeadAllowlist {
        export type RequestParams = {
            allowlistName: string;
        };
        export type RequestQuery = {
            /** if true, the content of the allowlist will be returned as well */
            with_content?: boolean;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = void;
    }

    /**
     * @description Check if an IP or range is in an allowlist
     * @tags watchers
     * @name CheckAllowlist
     * @summary checkAllowlist
     * @request GET:/allowlists/check/{ip_or_range}
     */
    export namespace CheckAllowlist {
        export type RequestParams = {
            ipOrRange: string;
        };
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = CheckAllowlistResponse;
    }

    /**
     * @description Check if an IP or range is in an allowlist
     * @tags watchers
     * @name HeadCheckAllowlist
     * @summary checkAllowlist
     * @request HEAD:/allowlists/check/{ip_or_range}
     */
    export namespace HeadCheckAllowlist {
        export type RequestParams = {
            ipOrRange: string;
        };
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = void;
    }

    /**
     * @description Check multiple IPs or ranges against allowlists
     * @tags watchers
     * @name PostCheckAllowlist
     * @summary postCheckAllowlist
     * @request POST:/allowlists/check
     */
    export namespace PostCheckAllowlist {
        export type RequestParams = {};
        export type RequestQuery = {};
        export type RequestBody = BulkCheckAllowlistRequest;
        export type RequestHeaders = {};
        export type ResponseBody = BulkCheckAllowlistResponse;
    }
}
