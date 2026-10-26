import debug from 'debug';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AppContext, ToolDefinition } from './types.js';
import { NAME, VERSION } from './version.js';

const log = debug('crowdsec-mcp:registry');

export function textResult(text: string): CallToolResult {
    return { content: [{ type: 'text', text }] };
}

export function errorResult(error: unknown): CallToolResult {
    const message = error instanceof Error ? error.message : String(error);
    log('tool error: %s', message);
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
