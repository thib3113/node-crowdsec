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
    // The status tool must never fail before its handler runs: reporting a
    // failed login is exactly what it is for. It triggers the login itself and
    // keeps the result in `ctx.readiness`.
    client: 'none',
    annotations: {
        readOnlyHint: true,
        idempotentHint: true
    },
    handler: async (_input, ctx) => {
        let connection = 'connected';
        try {
            await ctx.ensureReady('any');
        } catch {
            connection = 'connection failed';
        }

        const machineSuffix = ctx.config.machineId ? ` (${ctx.config.machineId})` : '';
        const authParts: string[] = [];
        if (ctx.capabilities.alerts) {
            authParts.push(`watcher${machineSuffix}`);
        }
        if (ctx.capabilities.decisionsFast) {
            authParts.push('bouncer');
        }
        const auth = authParts.length > 0 ? authParts.join(' + ') : ctx.mode;
        let writeLabel = 'no';
        if (ctx.capabilities.write) {
            writeLabel = ctx.config.readonly ? 'yes (disabled by read-only)' : 'yes';
        }
        const decisionPath = ctx.capabilities.decisionsFast
            ? 'bouncer (/v1/decisions, fast)'
            : 'watcher (alert scan; set CROWDSEC_API_KEY for the bouncer fast path)';
        const lines = [
            `CrowdSec MCP is ${connection}.`,
            '',
            bullets([
                `URL: ${redactedUrl(ctx.config.url)}`,
                `LAPI version: ${ctx.config.lapiVersion ?? 'not declared'}`,
                `Authentication: ${auth}`,
                `Capabilities: read=yes, write=${writeLabel}, allowlists=${ctx.capabilities.allowlists ? 'yes' : 'no'}`,
                `Credentials: alerts=${ctx.capabilities.alerts ? 'yes' : 'no'}, decisions=${
                    ctx.capabilities.decisions ? 'yes' : 'no'
                }, bouncer=${ctx.capabilities.decisionsFast ? 'configured' : 'no'}`,
                `Readiness: watcher=${ctx.readiness.watcher ?? 'unknown'}, bouncer=${ctx.readiness.bouncer ?? 'unknown'}`,
                `Decision path: ${decisionPath}`,
                `Timeout: ${ctx.config.timeout} ms (CROWDSEC_TIMEOUT, maximum 600000)`,
                `Read-only: ${ctx.config.readonly ? 'yes' : 'no'}`,
                `Default result limit: ${ctx.config.maxResults}`,
                `Maximum ban duration: ${ctx.config.maxBanDuration} (force=true can override)`,
                `Active tools: ${(ctx.activeTools ?? []).join(', ') || 'none'}`
            ])
        ];

        return lines.join('\n');
    }
};
