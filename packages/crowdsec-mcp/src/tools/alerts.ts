import { z } from 'zod';
import type { AppContext, ToolDefinition } from '../types.js';
import { formatAlertDetail, formatAlertList } from '../format/alerts.js';
import { cleanErrorMessage } from '../registry.js';
import type { APITypes } from 'crowdsec-client';
import {
    assertValidCidr,
    assertValidDecisionScope,
    assertValidDecisionType,
    assertValidScopeValue,
    isValidCidr,
    isValidIp,
    isValidTimeFilter,
    parsePositiveId,
    resolveListWindow
} from '../utils.js';

async function deleteAlertIds(ctx: AppContext, ids: number[]): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
        const response = await ctx.watcher!.Alerts.deleteById(String(id));
        deleted += Number(response.nbDeleted ?? 0);
    }
    return deleted;
}

const ListAlertsInput = z
    .object({
        ip: z.string().optional().describe('IP or CIDR range (CIDR performs containment)'),
        range: z.string().optional().describe('CIDR range (containment)'),
        scope: z.string().optional().describe('Filter by scope (Ip, Range, Username, etc.)'),
        value: z.string().optional().describe('Filter by value (used with scope)'),
        scenario: z.string().optional().describe('Filter by scenario name'),
        type: z.string().optional().describe('Filter by decision type (ban, captcha, etc.)'),
        origin: z.string().optional().describe('Filter by origin (cscli, crowdsec, etc.)'),
        kind: z.string().optional().describe('Filter by alert kind (crowdsec, waf, bot-detection, etc.)'),
        since: z.string().optional().describe('Filter alerts newer than this duration (e.g., 4h, 30d, 3650d)'),
        until: z.string().optional().describe('Filter alerts older than this duration (e.g., 4h, 30d, 3650d)'),
        has_active_decision: z.boolean().optional().describe('Only return alerts with active (non-expired) decisions'),
        all: z.boolean().optional().describe('Return all results (ignore limit)'),
        limit: z.number().int().positive().optional().describe('Maximum number of results to return')
    })
    .strict();

const GetAlertInput = z
    .object({
        id: z.union([z.string(), z.number()]).describe('Alert ID')
    })
    .strict();

const DeleteAlertsInput = z
    .object({
        id: z.union([z.string(), z.number()]).optional().describe('Delete a specific alert by ID'),
        ip: z.string().optional().describe('IP or CIDR range (CIDR performs containment)'),
        range: z.string().optional().describe('CIDR range (containment)'),
        scope: z.string().optional().describe('Filter by scope (Ip, Range, Username, etc.)'),
        value: z.string().optional().describe('Filter by value (used with scope)'),
        scenario: z.string().optional().describe('Filter by scenario name'),
        type: z.string().optional().describe('Filter by decision type (ban, captcha, throttle)'),
        origin: z.string().optional().describe('Filter by alert source/origin (cscli, crowdsec, etc.)'),
        since: z.string().optional().describe('Filter alerts newer than this duration (e.g., 4h, 30d)'),
        until: z.string().optional().describe('Filter alerts older than this duration (e.g., 4h, 30d)'),
        has_active_decision: z.boolean().optional().describe('Only delete alerts with active decisions'),
        all: z.boolean().optional().describe('Delete all matching alerts (requires confirm=true)'),
        confirm: z.boolean().optional().describe('Confirm deletion when using all=true')
    })
    .strict();

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

            const { ip, range, scope, value, scenario, type, origin, kind, since, until, has_active_decision, all, limit } =
                ListAlertsInput.parse(input);

            if (ip && !isValidIp(ip) && !isValidCidr(ip)) {
                throw new Error(`${ip} is not a valid ip or CIDR range`);
            }
            if (range) {
                assertValidCidr(range);
            }
            if (scope) {
                assertValidDecisionScope(scope);
            }
            if (scope && value) {
                assertValidScopeValue(scope, value);
            }
            const decisionType = type ? assertValidDecisionType(type) : undefined;
            if (since && !isValidTimeFilter(since)) {
                throw new Error(`invalid since '${since}': use h, m, s or d (e.g. 4h, 30d)`);
            }
            if (until && !isValidTimeFilter(until)) {
                throw new Error(`invalid until '${until}': use h, m, s or d (e.g. 4h, 30d)`);
            }

            const window = resolveListWindow(limit, all === true, ctx.config.maxResults);
            const query: APITypes.Alerts.SearchAlerts.RequestQuery & { kind?: string; contains?: boolean } = {
                ip,
                range,
                scope,
                value,
                scenario,
                decision_type: decisionType,
                origin,
                kind,
                since,
                until,
                contains: false,
                has_active_decision,
                limit: window.fetchLimit
            };

            const alerts = await ctx.watcher!.Alerts.search(query);

            return formatAlertList(alerts, window.displayLimit, window.maybeMore);
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

            const { id } = GetAlertInput.parse(input);
            const alertId = parsePositiveId(id, 'alert id');

            try {
                const alert = await ctx.watcher!.Alerts.getById(alertId);
                return formatAlertDetail(alert);
            } catch (error) {
                const message = cleanErrorMessage(error);
                if (/not found/i.test(message)) {
                    throw new Error(`Alert ${alertId} not found`);
                }
                throw error;
            }
        }
    },
    {
        name: 'delete_alerts',
        title: 'Delete alerts',
        description:
            'Delete alerts by ID or filters. Requires at least one filter or all=true with confirm=true; all=true cannot be combined with filters. ip and range accept a CIDR and perform containment. CrowdSec only allows alert deletion from the LAPI host; remote watchers receive 403.',
        inputSchema: DeleteAlertsInput,
        kind: 'write',
        requires: ['watcher'],
        feature: 'alert-delete',
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false
        },
        handler: async (input, ctx) => {
            await ctx.ensureReady();
            const { id, ip, range, scope, value, scenario, origin, type, since, until, has_active_decision, all, confirm } =
                DeleteAlertsInput.parse(input);

            if (since && !isValidTimeFilter(since)) {
                throw new Error(`invalid since '${since}': use h, m, s or d (e.g. 4h, 30d)`);
            }
            if (until && !isValidTimeFilter(until)) {
                throw new Error(`invalid until '${until}': use h, m, s or d (e.g. 4h, 30d)`);
            }

            const decisionType = type ? assertValidDecisionType(type) : undefined;

            if (all === true) {
                if (confirm !== true) {
                    throw new Error('Deleting all alerts requires confirm=true');
                }
                if (
                    id !== undefined ||
                    ip ||
                    range ||
                    scope ||
                    value ||
                    scenario ||
                    origin ||
                    decisionType ||
                    since ||
                    until ||
                    has_active_decision !== undefined
                ) {
                    throw new Error(
                        'Cannot combine all=true with id or filters; use all=true with confirm=true alone to delete everything'
                    );
                }
            }

            if (scope && (ip || range)) {
                throw new Error('Provide only one of ip, range, or scope');
            }

            if (ip && range) {
                throw new Error('Provide only one of ip or range');
            }
            if (ip && !isValidIp(ip) && !isValidCidr(ip)) {
                throw new Error(`${ip} is not a valid ip or CIDR range`);
            }
            if (range) {
                assertValidCidr(range);
            }

            const normalizedScope = scope ? assertValidDecisionScope(scope) : undefined;
            const normalizedValue = normalizedScope && value ? assertValidScopeValue(normalizedScope, value) : value;

            let result: APITypes.Alerts.DeleteAlerts.ResponseBody;

            if (id !== undefined) {
                if (ip || range || scope || value || scenario || origin || decisionType || since || until || all === true) {
                    throw new Error('Cannot combine id with filters or all=true');
                }

                const alertId = parsePositiveId(id, 'alert id');
                try {
                    result = await ctx.watcher!.Alerts.deleteById(alertId);
                } catch (error) {
                    const message = cleanErrorMessage(error);
                    if (/not found/i.test(message)) {
                        throw new Error(`Alert ${alertId} not found`);
                    }
                    throw error;
                }
            } else {
                const hasFilter =
                    ip ||
                    range ||
                    scope ||
                    value ||
                    scenario ||
                    origin ||
                    decisionType ||
                    since ||
                    until ||
                    has_active_decision !== undefined;
                if (!hasFilter && all !== true) {
                    throw new Error(
                        'At least one filter (ip, range, scope, value, scenario, origin, type, since, until, has_active_decision) or all=true is required'
                    );
                }

                if (normalizedScope && !value) {
                    const alerts = await ctx.watcher!.Alerts.search({
                        scope: normalizedScope,
                        origin,
                        has_active_decision,
                        limit: 0
                    });
                    const alertIds = alerts
                        .filter((alert) => alert.source?.scope?.toLowerCase() === normalizedScope.toLowerCase())
                        .map((alert) => alert.id)
                        .filter((alertId): alertId is number => typeof alertId === 'number');

                    if (alertIds.length === 0) {
                        return 'No matching alerts found.';
                    }

                    const deleted = await deleteAlertIds(ctx, alertIds);
                    return deleted === 0 ? 'No matching alerts found.' : `Deleted ${deleted} alert(s).`;
                }

                const cidr = range ?? (ip && isValidCidr(ip) ? ip : undefined);
                if (cidr) {
                    const alerts = await ctx.watcher!.Alerts.search({
                        ip: cidr,
                        contains: false,
                        scope: normalizedScope,
                        value: normalizedValue,
                        scenario,
                        origin,
                        has_active_decision,
                        limit: 0
                    } as APITypes.Alerts.SearchAlerts.RequestQuery & { contains?: boolean });

                    const alertIds = alerts.map((alert) => alert.id).filter((id): id is number => typeof id === 'number');
                    if (alertIds.length === 0) {
                        return 'No matching alerts found.';
                    }

                    const deleted = await deleteAlertIds(ctx, alertIds);
                    return deleted === 0 ? 'No matching alerts found.' : `Deleted ${deleted} alert(s).`;
                }

                if (origin || decisionType || since || until || has_active_decision !== undefined) {
                    const alerts = await ctx.watcher!.Alerts.search({
                        ip,
                        contains: false,
                        scope: normalizedScope,
                        value: normalizedValue,
                        scenario,
                        origin,
                        decision_type: decisionType,
                        since,
                        until,
                        has_active_decision,
                        limit: 0
                    } as APITypes.Alerts.SearchAlerts.RequestQuery & { contains?: boolean });

                    const alertIds = alerts.map((alert) => alert.id).filter((id): id is number => typeof id === 'number');
                    if (alertIds.length === 0) {
                        return 'No matching alerts found.';
                    }

                    const deleted = await deleteAlertIds(ctx, alertIds);
                    return deleted === 0 ? 'No matching alerts found.' : `Deleted ${deleted} alert(s).`;
                }

                const query: APITypes.Alerts.DeleteAlerts.RequestQuery = {
                    ip,
                    scope: normalizedScope,
                    value: normalizedValue,
                    scenario
                };

                result = await ctx.watcher!.Alerts.delete(query);
            }

            const count = Number(result.nbDeleted ?? 0);
            return count === 0 ? 'No matching alerts found.' : `Deleted ${count} alert(s).`;
        }
    }
];
