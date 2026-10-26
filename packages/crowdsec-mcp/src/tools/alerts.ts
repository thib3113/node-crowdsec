import { z } from 'zod';
import type { ToolDefinition } from '../types.js';
import { formatAlertDetail, formatAlertList } from '../format/alerts.js';
import type { APITypes } from 'crowdsec-client';

const ListAlertsInput = z.object({
    ip: z.string().optional().describe('Filter by IP address'),
    range: z.string().optional().describe('Filter by CIDR range'),
    scope: z.string().optional().describe('Filter by scope (Ip, Range, Username, etc.)'),
    value: z.string().optional().describe('Filter by value (used with scope)'),
    scenario: z.string().optional().describe('Filter by scenario name'),
    type: z.string().optional().describe('Filter by decision type (ban, captcha, etc.)'),
    origin: z.string().optional().describe('Filter by origin (cscli, crowdsec, etc.)'),
    kind: z.string().optional().describe('Filter by alert kind (crowdsec, waf, bot-detection, etc.)'),
    since: z.string().optional().describe('Filter alerts newer than this duration (e.g., 4h, 30m)'),
    until: z.string().optional().describe('Filter alerts older than this duration (e.g., 4h, 30m)'),
    simulated: z.boolean().optional().describe('Include simulated alerts'),
    has_active_decision: z.boolean().optional().describe('Only return alerts with active (non-expired) decisions'),
    all: z.boolean().optional().describe('Return all results (ignore limit)'),
    limit: z.number().int().positive().optional().describe('Maximum number of results to return')
});

const GetAlertInput = z.object({
    id: z.union([z.string(), z.number()]).describe('Alert ID')
});

const DeleteAlertsInput = z.object({
    id: z.union([z.string(), z.number()]).optional().describe('Delete a specific alert by ID'),
    ip: z.string().optional().describe('Filter by IP address'),
    range: z.string().optional().describe('Filter by CIDR range'),
    scope: z.string().optional().describe('Filter by scope (Ip, Range, Username, etc.)'),
    value: z.string().optional().describe('Filter by value (used with scope)'),
    scenario: z.string().optional().describe('Filter by scenario name'),
    all: z.boolean().optional().describe('Delete all matching alerts (requires confirm=true)'),
    confirm: z.boolean().optional().describe('Confirm deletion when using all=true')
});

export const alertTools: ToolDefinition[] = [
    {
        name: 'list_alerts',
        title: 'List alerts',
        description:
            'List alerts from CrowdSec with optional filters. Returns a table with ID, scope, value, reason, country, AS, decisions, creation time, and kind.',
        inputSchema: ListAlertsInput,
        kind: 'read',
        requires: ['watcher'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            const { ip, range, scope, value, scenario, type, origin, kind, since, until, simulated, has_active_decision, all, limit } =
                input as z.infer<typeof ListAlertsInput>;

            const query: APITypes.Alerts.SearchAlerts.RequestQuery & { kind?: string } = {
                ip,
                range,
                scope,
                value,
                scenario,
                decision_type: type,
                origin,
                kind,
                since,
                until,
                simulated,
                has_active_decision,
                limit: all === true ? 0 : (limit ?? ctx.config.maxResults)
            };

            const alerts = await ctx.watcher!.Alerts.search(query);

            return formatAlertList(alerts, ctx.config.maxResults);
        }
    },
    {
        name: 'get_alert',
        title: 'Get alert details',
        description: 'Get detailed information about a specific alert including decisions, meta, and events.',
        inputSchema: GetAlertInput,
        kind: 'read',
        requires: ['watcher'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            const { id } = input as z.infer<typeof GetAlertInput>;
            const alert = await ctx.watcher!.Alerts.getById(String(id));

            return formatAlertDetail(alert);
        }
    },
    {
        name: 'delete_alerts',
        title: 'Delete alerts',
        description:
            'Delete alerts by ID or filters. Requires at least one filter or all=true with confirm=true. CrowdSec only allows alert deletion from the LAPI host; remote watchers receive 403.',
        inputSchema: DeleteAlertsInput,
        kind: 'write',
        requires: ['watcher'],
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false
        },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            const { id, ip, range, scope, value, scenario, all, confirm } = input as z.infer<typeof DeleteAlertsInput>;

            if (all === true) {
                if (confirm !== true) {
                    throw new Error('Deleting all alerts requires confirm=true');
                }
            }

            let result: APITypes.Alerts.DeleteAlerts.ResponseBody;

            if (id !== undefined) {
                result = await ctx.watcher!.Alerts.deleteById(String(id));
            } else {
                const hasFilter = ip || range || scope || value || scenario;
                if (!hasFilter && all !== true) {
                    throw new Error('At least one filter (ip, range, scope, value, scenario) or all=true is required');
                }

                const query: APITypes.Alerts.DeleteAlerts.RequestQuery = {
                    ip,
                    range,
                    scope,
                    value,
                    scenario
                };

                result = await ctx.watcher!.Alerts.delete(query);
            }

            return `Deleted ${result.nbDeleted ?? 0} alert(s).`;
        }
    }
];
