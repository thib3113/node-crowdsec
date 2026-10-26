import { z } from 'zod';
import { redactedUrl } from '../config.js';
import { bullets } from '../format/common.js';
import type { ToolDefinition } from '../types.js';

export const statusTool: ToolDefinition = {
    name: 'crowdsec_status',
    title: 'CrowdSec status',
    description: 'Check the connection to the CrowdSec local API and show the authentication mode, capabilities and active MCP tools.',
    inputSchema: z.object({}),
    kind: 'read',
    annotations: {
        readOnlyHint: true,
        idempotentHint: true
    },
    handler: async (_input, ctx) => {
        await ctx.ensureReady();

        const auth = ctx.mode === 'watcher' ? `watcher${ctx.config.machineId ? ` (${ctx.config.machineId})` : ''}` : 'bouncer';
        const lines = [
            'CrowdSec MCP is connected.',
            '',
            bullets([
                `URL: ${redactedUrl(ctx.config.url)}`,
                `Authentication: ${auth}`,
                `Capabilities: read=yes, write=${ctx.capabilities.write ? 'yes' : 'no'}, allowlists=${ctx.capabilities.allowlists ? 'yes' : 'no'}`,
                `Read-only: ${ctx.config.readonly ? 'yes' : 'no'}`,
                `Default result limit: ${ctx.config.maxResults}`,
                `Maximum ban duration: ${ctx.config.maxBanDuration}`,
                `Active tools: ${(ctx.activeTools ?? []).join(', ') || 'none'}`
            ])
        ];

        return lines.join('\n');
    }
};
