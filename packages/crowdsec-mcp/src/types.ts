import type { BouncerClient, WatcherClient, APITypes } from 'crowdsec-client';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodType } from 'zod';
import type { Config } from './config.js';

export type AuthMode = 'bouncer' | 'watcher';

export interface Capabilities {
    read: boolean;
    write: boolean;
    allowlists: boolean;
}

export interface AllowlistsPort {
    list(): Promise<APITypes.GetAllowlistsResponse>;
    get(name: string, withContent?: boolean): Promise<APITypes.GetAllowlistResponse>;
    check(value: string): Promise<APITypes.CheckAllowlistResponse>;
    bulkCheck(targets: string[]): Promise<APITypes.BulkCheckAllowlistResponse>;
}

export interface AppContext {
    mode: AuthMode;
    capabilities: Capabilities;
    watcher?: WatcherClient;
    bouncer?: BouncerClient;
    allowlists: AllowlistsPort;
    config: Config;
    activeTools?: string[];
    ensureReady: () => Promise<void>;
    stop: () => Promise<void>;
}

export type ToolRequirement = 'watcher' | 'allowlists';

export interface ToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: ZodType;
    kind: 'read' | 'write';
    requires?: ToolRequirement[];
    annotations?: ToolAnnotations;
    handler: (input: Record<string, unknown>, ctx: AppContext) => Promise<CallToolResult | string>;
}
