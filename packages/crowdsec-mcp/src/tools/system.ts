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
        const machineSuffix = ctx.mode === 'watcher' && ctx.config.machineId ? ` (${ctx.config.machineId})` : '';
        const auth = ctx.mode === 'watcher' ? `watcher${machineSuffix}` : 'bouncer';
        const writeLabel = ctx.capabilities.write ? (ctx.config.readonly ? 'yes (disabled by read-only)' : 'yes') : 'no';
        const lines = [
            'CrowdSec MCP is connected.',
            '',
            bullets([
                `URL: ${redactedUrl(ctx.config.url)}`,
                `Authentication: ${auth}`,
                `Capabilities: read=yes, write=${writeLabel}, allowlists=${ctx.capabilities.allowlists ? 'yes' : 'no'}`,
                `Read-only: ${ctx.config.readonly ? 'yes' : 'no'}`,
                `Default result limit: ${ctx.config.maxResults}`,
                `Maximum ban duration: ${ctx.config.maxBanDuration} (force=true can override)`,
                `Active tools: ${(ctx.activeTools ?? []).join(', ') || 'none'}`
            ])
        ];

        return lines.join('\n');
    }
};
