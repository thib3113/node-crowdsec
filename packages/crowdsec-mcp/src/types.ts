import type { BouncerClient, WatcherClient, APITypes } from 'crowdsec-client';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodType } from 'zod';
import type { Config } from './config.js';

export type AuthMode = 'bouncer' | 'watcher';

export interface Capabilities {
    read: boolean;
    /** Watcher credentials: alerts, alert deletion and writes. */
    alerts: boolean;
    /** Any credentials: decisions can be listed/looked up. */
    decisions: boolean;
    /** Bouncer credentials: `/v1/decisions` fast path. */
    decisionsFast: boolean;
    /** Watcher credentials: write tools (ban/unban). */
    write: boolean;
    /** Watcher credentials: allowlists. */
    allowlists: boolean;
}

export interface AllowlistsPort {
    list(withContent?: boolean): Promise<APITypes.GetAllowlistsResponse>;
    get(name: string, withContent?: boolean): Promise<APITypes.GetAllowlistResponse>;
    check(value: string): Promise<APITypes.CheckAllowlistResponse>;
    bulkCheck(targets: string[]): Promise<APITypes.BulkCheckAllowlistResponse>;
}

export type ReadinessRequirement = 'watcher' | 'bouncer' | 'any' | 'none';

export type ClientReadinessState = 'ok' | 'error';

export interface ClientReadiness {
    watcher?: ClientReadinessState;
    bouncer?: ClientReadinessState;
}

export interface AppContext {
    mode: AuthMode;
    capabilities: Capabilities;
    watcher?: WatcherClient;
    bouncer?: BouncerClient;
    allowlists: AllowlistsPort;
    config: Config;
    activeTools?: string[];
    /** Last login result per configured client, for crowdsec_status. */
    readiness: ClientReadiness;
    /** Log in lazily, only for the client(s) the current tool needs. */
    ensureReady: (requirement?: ReadinessRequirement) => Promise<void>;
    stop: () => Promise<void>;
}

export type ToolRequirement = 'alerts' | 'write' | 'allowlists';
export type ToolFeature = 'alert-delete';

export interface ToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: ZodType;
    kind: 'read' | 'write';
    requires?: ToolRequirement[];
    /** Client that must be logged in before the handler runs. Defaults to watcher when `requires` is set, none otherwise. */
    client?: ReadinessRequirement;
    feature?: ToolFeature;
    annotations?: ToolAnnotations;
    handler: (input: unknown, ctx: AppContext) => CallToolResult | string | Promise<CallToolResult | string>;
}
