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

import { AddAlertsRequest, AddAlertsResponse, Alert, DeleteAlertsResponse, GetAlertsResponse } from './data-contracts.js';

export namespace Alerts {
    /**
     * @description Push alerts to API
     * @tags watchers
     * @name PushAlerts
     * @summary pushAlerts
     * @request POST:/alerts
     * @secure
     */
    export namespace PushAlerts {
        export type RequestParams = {};
        export type RequestQuery = {};
        export type RequestBody = AddAlertsRequest;
        export type RequestHeaders = {};
        export type ResponseBody = AddAlertsResponse;
    }

    /**
     * @description Allows to search for alerts
     * @tags watchers
     * @name SearchAlerts
     * @summary searchAlerts
     * @request GET:/alerts
     * @secure
     */
    export namespace SearchAlerts {
        export type RequestParams = {};
        export type RequestQuery = {
            /** show alerts for this scope */
            scope?: string;
            /** show alerts for this value (used with scope) */
            value?: string;
            /** show alerts for this scenario */
            scenario?: string;
            /** IP to search for (shorthand for scope=ip&value=) */
            ip?: string;
            /** range to search for (shorthand for scope=range&value=) */
            range?: string;
            /**
             * search alerts newer than delay (format must be compatible with time.ParseDuration)
             * @format date-time
             */
            since?: string;
            /**
             * search alerts older than delay (format must be compatible with time.ParseDuration)
             * @format date-time
             */
            until?: string;
            /** if set to true, decisions in simulation mode will be returned as well */
            simulated?: boolean;
            /** only return alerts with decisions not expired yet */
            has_active_decision?: boolean;
            /** restrict results to alerts with decisions matching given type */
            decision_type?: string;
            /** number of alerts to return */
            limit?: number;
            /** restrict results to this origin (ie. lists,CAPI,cscli) */
            origin?: string;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = GetAlertsResponse;
    }

    /**
     * @description Allows to search for alerts
     * @tags watchers
     * @name HeadAlerts
     * @summary searchAlerts
     * @request HEAD:/alerts
     * @secure
     */
    export namespace HeadAlerts {
        export type RequestParams = {};
        export type RequestQuery = {
            /** show alerts for this scope */
            scope?: string;
            /** show alerts for this value (used with scope) */
            value?: string;
            /** show alerts for this scenario */
            scenario?: string;
            /** IP to search for (shorthand for scope=ip&value=) */
            ip?: string;
            /** range to search for (shorthand for scope=range&value=) */
            range?: string;
            /**
             * search alerts newer than delay (format must be compatible with time.ParseDuration)
             * @format date-time
             */
            since?: string;
            /**
             * search alerts older than delay (format must be compatible with time.ParseDuration)
             * @format date-time
             */
            until?: string;
            /** if set to true, decisions in simulation mode will be returned as well */
            simulated?: boolean;
            /** only return alerts with decisions not expired yet */
            has_active_decision?: boolean;
            /** restrict results to alerts with decisions matching given type */
            decision_type?: string;
            /** number of alerts to return */
            limit?: number;
            /** restrict results to this origin (ie. lists,CAPI,cscli) */
            origin?: string;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = void;
    }

    /**
     * @description Allows to delete alerts
     * @tags watchers
     * @name DeleteAlerts
     * @summary deleteAlerts
     * @request DELETE:/alerts
     * @secure
     */
    export namespace DeleteAlerts {
        export type RequestParams = {};
        export type RequestQuery = {
            /** delete alerts for this scope */
            scope?: string;
            /** delete alerts for this value (used with scope) */
            value?: string;
            /** delete alerts for this scenario */
            scenario?: string;
            /** delete Alerts with IP (shorthand for scope=ip&value=) */
            ip?: string;
            /** delete alerts concerned by range (shorthand for scope=range&value=) */
            range?: string;
            /**
             * delete alerts added after YYYY-mm-DD-HH:MM:SS
             * @format date-time
             */
            since?: string;
            /**
             * delete alerts added before YYYY-mm-DD-HH:MM:SS
             * @format date-time
             */
            until?: string;
            /** delete only alerts with decisions not expired yet */
            has_active_decision?: boolean;
            /** delete only alerts with matching source (ie. cscli/crowdsec) */
            alert_source?: string;
        };
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = DeleteAlertsResponse;
    }

    /**
     * @description Get alert by ID
     * @tags watchers
     * @name GetAlertbyId
     * @summary GetAlertByID
     * @request GET:/alerts/{alert_id}
     * @secure
     */
    export namespace GetAlertbyId {
        export type RequestParams = {
            alertId: string;
        };
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = Alert;
    }

    /**
     * @description Get alert by ID
     * @tags watchers
     * @name HeadAlertbyId
     * @summary GetAlertByID
     * @request HEAD:/alerts/{alert_id}
     * @secure
     */
    export namespace HeadAlertbyId {
        export type RequestParams = {
            alertId: string;
        };
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = void;
    }

    /**
     * @description Delete alert for given alert ID (only from cscli)
     * @tags watchers
     * @name DeleteAlert
     * @summary DeleteAlert
     * @request DELETE:/alerts/{alert_id}
     * @secure
     */
    export namespace DeleteAlert {
        export type RequestParams = {
            alertId: string;
        };
        export type RequestQuery = {};
        export type RequestBody = never;
        export type RequestHeaders = {};
        export type ResponseBody = DeleteAlertsResponse;
    }
}
