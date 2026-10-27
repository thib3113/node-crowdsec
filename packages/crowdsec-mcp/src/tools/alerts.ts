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
    const responses = await Promise.all(ids.map((id) => ctx.watcher!.Alerts.deleteById(String(id))));
    return responses.reduce((total, response) => total + Number(response.nbDeleted ?? 0), 0);
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

type DeleteAlertInput = z.infer<typeof DeleteAlertsInput>;

interface NormalizedDeleteAlertInput extends DeleteAlertInput {
    decisionType?: string;
    normalizedScope?: string;
    normalizedValue?: string;
}

function validateDeleteTimes(since?: string, until?: string): void {
    if (since && !isValidTimeFilter(since)) {
        throw new Error(`invalid since '${since}': use h, m, s or d (e.g. 4h, 30d)`);
    }
    if (until && !isValidTimeFilter(until)) {
        throw new Error(`invalid until '${until}': use h, m, s or d (e.g. 4h, 30d)`);
    }
}

function hasDeleteFilters(input: DeleteAlertInput, decisionType?: string): boolean {
    return Boolean(
        input.ip ||
        input.range ||
        input.scope ||
        input.value ||
        input.scenario ||
        input.origin ||
        decisionType ||
        input.since ||
        input.until ||
        input.has_active_decision !== undefined
    );
}

function assertAllDelete(input: DeleteAlertInput, decisionType?: string): void {
    if (input.confirm !== true) {
        throw new Error('Deleting all alerts requires confirm=true');
    }
    if (input.id !== undefined || hasDeleteFilters(input, decisionType)) {
        throw new Error('Cannot combine all=true with id or filters; use all=true with confirm=true alone to delete everything');
    }
}

function assertDeleteTargets(input: DeleteAlertInput): void {
    if (input.scope && (input.ip || input.range)) {
        throw new Error('Provide only one of ip, range, or scope');
    }
    if (input.ip && input.range) {
        throw new Error('Provide only one of ip or range');
    }
    if (input.ip && !isValidIp(input.ip) && !isValidCidr(input.ip)) {
        throw new Error(`${input.ip} is not a valid ip or CIDR range`);
    }
    if (input.range) {
        assertValidCidr(input.range);
    }
}

function normalizeDeleteInput(input: DeleteAlertInput): NormalizedDeleteAlertInput {
    validateDeleteTimes(input.since, input.until);
    const decisionType = input.type ? assertValidDecisionType(input.type) : undefined;

    if (input.all === true) {
        assertAllDelete(input, decisionType);
    }
    assertDeleteTargets(input);

    if (input.scope && !input.value) {
        throw new Error('scope and value must be provided together for delete_alerts');
    }

    const normalizedScope = input.scope ? assertValidDecisionScope(input.scope) : undefined;
    const normalizedValue = normalizedScope && input.value ? assertValidScopeValue(normalizedScope, input.value) : input.value;

    if (input.id !== undefined && hasDeleteFilters(input, decisionType)) {
        throw new Error('Cannot combine id with filters or all=true');
    }
    if (input.id === undefined && input.all !== true && !hasDeleteFilters(input, decisionType)) {
        throw new Error(
            'At least one filter (ip, range, scope, value, scenario, origin, type, since, until, has_active_decision) or all=true is required'
        );
    }

    return { ...input, decisionType, normalizedScope, normalizedValue };
}

function formatDeletedCount(count: number): string {
    return count === 0 ? 'No matching alerts found.' : `Deleted ${count} alert(s).`;
}

async function deleteAlertsByIds(ctx: AppContext, ids: number[]): Promise<string> {
    if (ids.length === 0) {
        return 'No matching alerts found.';
    }
    return formatDeletedCount(await deleteAlertIds(ctx, ids));
}

async function deleteAlertsById(ctx: AppContext, id: string | number): Promise<string> {
    const alertId = parsePositiveId(id, 'alert id');
    try {
        const result = await ctx.watcher!.Alerts.deleteById(alertId);
        return formatDeletedCount(Number(result.nbDeleted ?? 0));
    } catch (error) {
        const message = cleanErrorMessage(error);
        if (/not found/i.test(message)) {
            throw new Error(`Alert ${alertId} not found`);
        }
        throw error;
    }
}

async function deleteAlertsByCidr(ctx: AppContext, filters: NormalizedDeleteAlertInput, cidr: string): Promise<string> {
    const alerts = await ctx.watcher!.Alerts.search({
        ip: cidr,
        contains: false,
        scope: filters.normalizedScope,
        value: filters.normalizedValue,
        scenario: filters.scenario,
        origin: filters.origin,
        has_active_decision: filters.has_active_decision,
        limit: 0
    } as APITypes.Alerts.SearchAlerts.RequestQuery & { contains?: boolean });

    return deleteAlertsByIds(
        ctx,
        alerts.map((alert) => alert.id).filter((id): id is number => typeof id === 'number')
    );
}

async function deleteAlertsBySearch(ctx: AppContext, filters: NormalizedDeleteAlertInput): Promise<string> {
    const alerts = await ctx.watcher!.Alerts.search({
        ip: filters.ip,
        contains: false,
        scope: filters.normalizedScope,
        value: filters.normalizedValue,
        scenario: filters.scenario,
        origin: filters.origin,
        decision_type: filters.decisionType,
        since: filters.since,
        until: filters.until,
        has_active_decision: filters.has_active_decision,
        limit: 0
    } as APITypes.Alerts.SearchAlerts.RequestQuery & { contains?: boolean });

    return deleteAlertsByIds(
        ctx,
        alerts.map((alert) => alert.id).filter((id): id is number => typeof id === 'number')
    );
}

async function deleteAlertsDirect(ctx: AppContext, filters: NormalizedDeleteAlertInput): Promise<string> {
    const result = await ctx.watcher!.Alerts.delete({
        ip: filters.ip,
        scope: filters.normalizedScope,
        value: filters.normalizedValue,
        scenario: filters.scenario
    });

    return formatDeletedCount(Number(result.nbDeleted ?? 0));
}

async function deleteAllAlerts(ctx: AppContext): Promise<string> {
    const result = await ctx.watcher!.Alerts.delete({});
    return formatDeletedCount(Number(result.nbDeleted ?? 0));
}

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
            const filters = normalizeDeleteInput(DeleteAlertsInput.parse(input));

            if (filters.id !== undefined) {
                return deleteAlertsById(ctx, filters.id);
            }
            if (filters.all === true) {
                return deleteAllAlerts(ctx);
            }

            const cidr = filters.range ?? (filters.ip && isValidCidr(filters.ip) ? filters.ip : undefined);
            if (cidr) {
                return deleteAlertsByCidr(ctx, filters, cidr);
            }
            if (filters.origin || filters.decisionType || filters.since || filters.until || filters.has_active_decision !== undefined) {
                return deleteAlertsBySearch(ctx, filters);
            }

            return deleteAlertsDirect(ctx, filters);
        }
    }
];
