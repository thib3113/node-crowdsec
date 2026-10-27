import debug from 'debug';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AppContext, ToolDefinition } from './types.js';
import { NAME, VERSION } from './version.js';

const log = debug('crowdsec-mcp:registry');

export function textResult(text: string): CallToolResult {
    return { content: [{ type: 'text', text }] };
}

export function cleanErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    let message = raw.split(/\r?\n/, 1)[0].trim();

    // The client embeds its internal class name (and sometimes the ORM prefix)
    // in error messages. Keep only the business message.
    message = message.replace(/^CrowdSecError \(\d+\)\s*:\s*/i, '');
    message = message.replace(/^ent:\s*/i, '');
    message = message.replace(/^object not found$/i, 'Resource not found');
    message = message.replace(/^alert not found$/i, 'Alert not found');
    message = message.replace(/^while parsing duration.*/i, 'Invalid duration');

    const allowlist = message.match(/^allowlist '(.+)' not found$/i);
    if (allowlist) {
        message = `Allowlist '${allowlist[1]}' not found`;
    }

    const decision = message.match(/^decision with id '(.+)' doesn't exist.*/i);
    if (decision) {
        message = `Decision ${decision[1]} not found`;
    }

    if (/^access forbidden from this IP/i.test(message)) {
        message = 'Access forbidden from this IP (alert deletion is only allowed from the LAPI host)';
    }

    return message || 'unknown error';
}

export function errorResult(error: unknown): CallToolResult {
    const raw = error instanceof Error ? error.message : String(error);
    // Client errors can embed a full stack in their message. Keep only the first
    // cleaned line so tool output stays actionable and does not leak internals.
    const message = cleanErrorMessage(error);
    log('tool error: %s', raw);
    return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true
    };
}

export function selectTools(tools: ToolDefinition[], ctx: AppContext): ToolDefinition[] {
    const context = ctx;
    const knownNames = new Set(tools.map((tool) => tool.name));

    if (context.config.tools) {
        const unknown = context.config.tools.filter((name) => !knownNames.has(name));
        if (unknown.length > 0) {
            throw new Error(`unknown tool(s) in CROWDSEC_MCP_TOOLS: ${unknown.join(', ')}`);
        }
    }

    const selected = tools.filter((tool) => {
        if (context.config.readonly && tool.kind === 'write') {
            return false;
        }

        if (tool.requires?.includes('watcher') && context.mode !== 'watcher') {
            return false;
        }

        if (tool.requires?.includes('allowlists') && !context.capabilities.allowlists) {
            return false;
        }

        if (tool.feature === 'alert-delete') {
            if (!context.config.enableAlertDelete) {
                return false;
            }

            // delete_alerts is local-only and destructive. In passthrough mode
            // without a service token, any LAPI token holder could reach it, so
            // hide it unless the operator explicitly forces it.
            if (context.config.passthrough && !context.config.http.token && !context.config.allowAlertDeleteWithoutToken) {
                return false;
            }
        }

        if (context.config.tools && !context.config.tools.includes(tool.name)) {
            return false;
        }

        if (context.config.disableTools.includes(tool.name)) {
            return false;
        }

        return true;
    });

    const selectedNames = new Set(selected.map((tool) => tool.name));
    for (const requested of context.config.tools ?? []) {
        if (!selectedNames.has(requested)) {
            log('tool %s is known but unavailable in the current mode', requested);
        }
    }

    return selected;
}

export function createServer(tools: ToolDefinition[], ctx: AppContext): McpServer {
    const server = new McpServer({ name: NAME, version: VERSION });
    ctx.activeTools = tools.map((tool) => tool.name);

    for (const tool of tools) {
        const handler = async (input: unknown): Promise<CallToolResult> => {
            try {
                await ctx.ensureReady();
                const result = await tool.handler((input ?? {}) as Record<string, unknown>, ctx);
                return typeof result === 'string' ? textResult(result) : result;
            } catch (error) {
                return errorResult(error);
            }
        };

        server.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema as never,
                annotations: tool.annotations
            },
            handler as never
        );
    }

    log('registered %d tool(s): %s', tools.length, tools.map((tool) => tool.name).join(', '));
    return server;
}
