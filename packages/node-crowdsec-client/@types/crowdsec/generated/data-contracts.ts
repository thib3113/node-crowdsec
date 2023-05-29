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

/** WatcherRegistrationRequest */
export interface WatcherRegistrationRequest {
    machine_id: string;
    /** @format password */
    password: string;
}

/** WatcherAuthRequest */
export interface WatcherAuthRequest {
    machine_id: string;
    /** @format password */
    password: string;
    /** the list of scenarios enabled on the watcher */
    scenarios?: string[];
}

/**
 * WatcherAuthResponse
 * the response of a successful authentication
 */
export interface WatcherAuthResponse {
    code?: number;
    expire?: string;
    token?: string;
}

/** Alert */
export interface Alert {
    /** only relevant for GET, ignored in POST requests */
    id?: number;
    /** only relevant for LAPI->CAPI, ignored for cscli->LAPI and crowdsec->LAPI */
    uuid?: string;
    /** only relevant for LAPI->CAPI, ignored for cscli->LAPI and crowdsec->LAPI */
    machine_id?: string;
    /** only relevant for GET, ignored in POST requests */
    created_at?: string;
    scenario: string;
    scenario_hash: string;
    scenario_version: string;
    /** a human readable message */
    message: string;
    /** @format int32 */
    events_count: number;
    start_at: string;
    stop_at: string;
    /** @format int32 */
    capacity: number;
    leakspeed: string;
    simulated: boolean;
    /** the Meta of the events leading to overflow */
    events: Event[];
    remediation?: boolean;
    decisions?: Decision[];
    source: Source;
    /** the Meta data of the Alert itself */
    meta?: Meta;
    labels?: string[];
}

/** Source */
export interface Source {
    /** the scope of a source : ip,range,username,etc */
    scope: string;
    /** the value of a source : the ip, the range, the username,etc */
    value: string;
    /** provided as a convenience when the source is an IP */
    ip?: string;
    /** provided as a convenience when the source is an IP */
    range?: string;
    /** provided as a convenience when the source is an IP */
    as_number?: string;
    /** provided as a convenience when the source is an IP */
    as_name?: string;
    cn?: string;
    /** @format float */
    latitude?: number;
    /** @format float */
    longitude?: number;
}

/** Metrics */
export interface Metrics {
    /** the local version of crowdsec/apil */
    apil_version: string;
    bouncers: MetricsBouncerInfo[];
    machines: MetricsAgentInfo[];
}

/**
 * MetricsBouncerInfo
 * Software version info (so we can warn users about out-of-date software). The software name and the version are "guessed" from the user-agent
 */
export interface MetricsBouncerInfo {
    /** name of the component */
    custom_name?: string;
    /** bouncer type (firewall, php ...) */
    name?: string;
    /** software version */
    version?: string;
    /** last bouncer pull date */
    last_pull?: string;
}

/**
 * MetricsAgentInfo
 * Software version info (so we can warn users about out-of-date software). The software name and the version are "guessed" from the user-agent
 */
export interface MetricsAgentInfo {
    /** name of the component */
    name?: string;
    /** software version */
    version?: string;
    /** last agent update date */
    last_update?: string;
    /** last agent push date */
    last_push?: string;
}

/** Decision */
export interface Decision {
    /** (only relevant for GET ops) the unique id */
    id?: number;
    /** only relevant for LAPI->CAPI, ignored for cscli->LAPI and crowdsec->LAPI */
    uuid?: string;
    /** the origin of the decision : cscli, crowdsec */
    origin: string;
    /** the type of decision, might be 'ban', 'captcha' or something custom. Ignored when watcher (cscli/crowdsec) is pushing to APIL. */
    type: string;
    /** the scope of decision : does it apply to an IP, a range, a username, etc */
    scope: string;
    /** the value of the decision scope : an IP, a range, a username, etc */
    value: string;
    /** the duration of the decisions */
    duration: string;
    /** the date until the decisions must be active */
    until?: string;
    scenario: string;
    /** true if the decision result from a scenario in simulation mode */
    simulated?: boolean;
}

/** DeleteDecisionResponse */
export interface DeleteDecisionResponse {
    /** number of deleted decisions */
    nbDeleted?: string;
}

/** AddAlertsRequest */
export type AddAlertsRequest = Alert[];

/** AddAlertsResponse */
export type AddAlertsResponse = string[];

/** AlertsResponse */
export type GetAlertsResponse = Alert[];

/** DeleteAlertsResponse */
export interface DeleteAlertsResponse {
    /** number of deleted alerts */
    nbDeleted?: string;
}

/** DecisionsStreamResponse */
export interface DecisionsStreamResponse {
    new?: GetDecisionsResponse;
    deleted?: GetDecisionsResponse;
}

/** Event */
export interface Event {
    timestamp: string;
    /** the Meta data of the Alert itself */
    meta: Meta;
}

/** GetDecisionsResponse */
export type GetDecisionsResponse = Decision[];

/**
 * Meta
 * the Meta data of the Alert itself
 */
export type Meta = {
    key?: string;
    value?: string;
}[];

/**
 * error response
 * error response return by the API
 */
export interface ErrorResponse {
    /** Error message */
    message: string;
    /** more detail on individual errors */
    errors?: string;
}

export interface GetDecisionsStreamParams {
    /** If true, means that the bouncers is starting and a full list must be provided */
    startup?: boolean;
    /** Comma separated scopes of decisions to fetch */
    scopes?: string;
    /** Comma separated name of origins. If provided, then only the decisions originating from provided origins would be returned. */
    origins?: string;
    /** Comma separated words. If provided, only the decisions created by scenarios containing any of the provided word would be returned. */
    scenarios_containing?: string;
    /** Comma separated words. If provided, only the decisions created by scenarios, not containing any of the provided word would be returned. */
    scenarios_not_containing?: string;
}

export interface HeadDecisionsStreamParams {
    /** If true, means that the bouncer is starting and a full list must be provided */
    startup?: boolean;
}

export interface GetDecisionsParams {
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
}

export interface HeadDecisionsParams {
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
}

export interface DeleteDecisionsParams {
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
}

export interface SearchAlertsParams {
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
}

export interface HeadAlertsParams {
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
}

export interface DeleteAlertsParams {
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
}
