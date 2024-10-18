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

import { DecisionsStreamResponse, DeleteDecisionResponse, GetDecisionsResponse } from './data-contracts.js';

export namespace Decisions {
    /**
     * @description Returns a list of new/expired decisions. Intended for remediation component that need to "stream" decisions
     * @tags Remediation component
     * @name GetDecisionsStream
     * @summary getDecisionsStream
     * @request GET:/decisions/stream
     * @secure
     */
    export namespace GetDecisionsStream {
        export type RequestParams = {};
        export type RequestQuery = {
            /** If true, means that the remediation component is starting and a full list must be provided */
            startup?: boolean;
            /** Comma separated scopes of decisions to fetch */
            scopes?: string;
            /** Comma separated name of origins. If provided, then only the decisions originating from provided origins would be returned. */
            origins?: string;
            /** Comma separated words. If provided, only the decisions created by scenarios containing any of the provided word would be returned. */
            scenarios_containing?: string;
            /** Comma separated words. If provided, only the decisions created by scenarios, not containing any of the provided word would be returned. */
            scenarios_not_containing?: string;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = DecisionsStreamResponse;
    }

    /**
     * @description Returns a list of new/expired decisions. Intended for remediation component that need to "stream" decisions
     * @tags Remediation component
     * @name HeadDecisionsStream
     * @summary GetDecisionsStream
     * @request HEAD:/decisions/stream
     * @secure
     */
    export namespace HeadDecisionsStream {
        export type RequestParams = {};
        export type RequestQuery = {
            /** If true, means that the bouncer is starting and a full list must be provided */
            startup?: boolean;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = void;
    }

    /**
     * @description Returns information about existing decisions
     * @tags Remediation component
     * @name GetDecisions
     * @summary getDecisions
     * @request GET:/decisions
     * @secure
     */
    export namespace GetDecisions {
        export type RequestParams = {};
        export type RequestQuery = {
            /** scope to which the decision applies (ie. IP/Range/Username/Session/...) */
            scope?: string;
            /** the value to match for in the specified scope */
            value?: string;
            /** type of decision */
            type?: string;
            /** IP to search for (shorthand for scope=ip&value=) */
            ip?: string;
            /** range to search for (shorthand for scope=range&value=) */
            range?: string;
            /** indicate if you're looking for a decision that contains the value, or that is contained within the value */
            contains?: boolean;
            /** Comma separated name of origins. If provided, then only the decisions originating from provided origins would be returned. */
            origins?: string;
            /** Comma separated words. If provided, only the decisions created by scenarios containing any of the provided word would be returned. */
            scenarios_containing?: string;
            /** Comma separated words. If provided, only the decisions created by scenarios, not containing any of the provided word would be returned. */
            scenarios_not_containing?: string;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = GetDecisionsResponse;
    }

    /**
     * @description Returns information about existing decisions
     * @tags Remediation component
     * @name HeadDecisions
     * @summary GetDecisions
     * @request HEAD:/decisions
     * @secure
     */
    export namespace HeadDecisions {
        export type RequestParams = {};
        export type RequestQuery = {
            /** scope to which the decision applies (ie. IP/Range/Username/Session/...) */
            scope?: string;
            /** the value to match for in the specified scope */
            value?: string;
            /** type of decision */
            type?: string;
            /** IP to search for (shorthand for scope=ip&value=) */
            ip?: string;
            /** range to search for (shorthand for scope=range&value=) */
            range?: string;
            /** indicate if you're looking for a decision that contains the value, or that is contained within the value */
            contains?: boolean;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = void;
    }

    /**
     * @description Delete decisions(s) for given filters (only from cscli)
     * @tags watchers
     * @name DeleteDecisions
     * @summary deleteDecisions
     * @request DELETE:/decisions
     * @secure
     */
    export namespace DeleteDecisions {
        export type RequestParams = {};
        export type RequestQuery = {
            /** scope to which the decision applies (ie. IP/Range/Username/Session/...) */
            scope?: string;
            /** the value to match for in the specified scope */
            value?: string;
            /** type of decision */
            type?: string;
            /** IP to search for (shorthand for scope=ip&value=) */
            ip?: string;
            /** range to search for (shorthand for scope=range&value=) */
            range?: string;
            /** scenario to search */
            scenario?: string;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = DeleteDecisionResponse;
    }

    /**
     * @description Delete decision for given decision ID (only from cscli)
     * @tags watchers
     * @name DeleteDecision
     * @summary DeleteDecision
     * @request DELETE:/decisions/{decision_id}
     * @secure
     */
    export namespace DeleteDecision {
        export type RequestParams = {
            decisionId: string;
        };
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = DeleteDecisionResponse;
    }
}
