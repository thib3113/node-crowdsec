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
    isTotalCidr,
    isValidCidr,
    isValidIp,
    isValidTimeFilter,
    mapWithConcurrency,
    parseDuration,
    parsePositiveId,
    resolveDecisionExpiry,
    resolveListWindow,
    toGoDuration
} from '../utils.js';

const DELETE_CONCURRENCY = 8;

async function deleteAlertIds(ctx: AppContext, ids: number[]): Promise<number> {
    const responses = await mapWithConcurrency(ids, DELETE_CONCURRENCY, (id) => ctx.watcher!.Alerts.deleteById(String(id)));
    return responses.reduce((total, response) => total + Number(response.nbDeleted ?? 0), 0);
}

/**
 * Re-check the decision-level filters locally before deleting whole alerts.
 * The search is expected to apply them, but a LAPI that silently ignores an
 * unread filter would otherwise delete alerts outside the requested set.
 */
function alertMatchesDeleteFilters(alert: APITypes.Alert, filters: NormalizedDeleteAlertInput): boolean {
    const decisions = alert.decisions ?? [];
    const hasDecisionFilter = Boolean(filters.decisionType || filters.origin || filters.scenario || filters.has_active_decision === true);

    // A single decision must satisfy the whole conjunction: an alert with
    // `ban`/origin A and `captcha`/origin B must not match `type=ban&origin=B`.
    if (hasDecisionFilter) {
        const matches = decisions.some((decision) => {
            if (filters.decisionType && decision.type?.toLowerCase() !== filters.decisionType.toLowerCase()) {
                return false;
            }
            if (filters.origin && decision.origin?.toLowerCase() !== filters.origin.toLowerCase()) {
                return false;
            }
            if (filters.scenario && decision.scenario?.toLowerCase() !== filters.scenario.toLowerCase()) {
                return false;
            }
            // `duration` is the remaining duration at fetch time (same
            // convention as Decision.endAt and the formatters), so do not
            // anchor it on alert.created_at.
            if (filters.has_active_decision === true && !resolveDecisionExpiry(decision).active) {
                return false;
            }
            return true;
        });
        if (!matches) {
            return false;
        }
    }

    if (filters.has_active_decision === false && decisions.length > 0) {
        return false;
    }

    const createdAt = alert.created_at ? Date.parse(alert.created_at) : Number.NaN;
    if (Number.isFinite(createdAt)) {
        const now = Date.now();
        if (filters.since && createdAt < now - parseDuration(filters.since) * 1000) {
            return false;
        }
        if (filters.until && createdAt > now - parseDuration(filters.until) * 1000) {
            return false;
        }
    }

    return true;
}

const ListAlertsInput = z
    .object({
        ip: z
            .string()
            .optional()
            .describe(
                'IP or CIDR range. The LAPI matches alerts through their decisions, so alerts without decisions are never returned; use scope+value to filter the alert source.'
            ),
        range: z
            .string()
            .optional()
            .describe('CIDR range matched against the decisions attached to alerts. Alerts without decisions never match.'),
        scope: z.string().optional().describe('Filter the alert source by scope (Ip, Range, Username, etc.).'),
        value: z.string().optional().describe('Filter the alert source by value (used with scope).'),
        scenario: z.string().optional().describe('Filter by scenario name.'),
        type: z.string().optional().describe('Filter by decision type (ban, captcha, etc.). This filters at the alert level.'),
        origin: z.string().optional().describe('Filter by decision origin (cscli, crowdsec, capi, console, ...), not by alert kind.'),
        kind: z
            .string()
            .optional()
            .describe('Filter by alert kind (crowdsec, waf, bot-detection, cscli, ...). The match is case-sensitive.'),
        contains: z
            .boolean()
            .optional()
            .default(false)
            .describe(
                'Only with ip/range: false (default) matches alerts whose decisions are contained within the value; true matches alerts whose decisions contain the value.'
            ),
        since: z.string().optional().describe('Filter alerts newer than this duration (e.g., 4h, 30d, 3650d)'),
        until: z.string().optional().describe('Filter alerts older than this duration (e.g., 4h, 30d, 3650d)'),
        has_active_decision: z
            .boolean()
            .optional()
            .describe('true: alerts with at least one active decision; false: alerts with no decisions at all.'),
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
        ip: z
            .string()
            .optional()
            .describe('IP or CIDR range matched through the alerts decisions; alerts without decisions are never matched.'),
        range: z
            .string()
            .optional()
            .describe('CIDR range matched through the alerts decisions; alerts without decisions are never matched.'),
        scope: z.string().optional().describe('Filter the alert source by scope (Ip, Range, Username, etc.).'),
        value: z.string().optional().describe('Filter the alert source by value (used with scope).'),
        scenario: z.string().optional().describe('Filter by scenario name.'),
        type: z.string().optional().describe('Filter by decision type (ban, captcha, throttle). This filters at the alert level.'),
        origin: z.string().optional().describe('Filter by decision origin (cscli, crowdsec, capi, console, ...), not by alert kind.'),
        since: z.string().optional().describe('Filter alerts newer than this duration (e.g., 4h, 30d)'),
        until: z.string().optional().describe('Filter alerts older than this duration (e.g., 4h, 30d)'),
        has_active_decision: z
            .boolean()
            .optional()
            .describe('true: alerts with at least one active decision; false: alerts with no decisions at all.'),
        all: z.boolean().optional().describe('Delete all matching alerts (requires confirm=true)'),
        confirm: z.boolean().optional().describe('Confirm deletion when using all=true or broad filters')
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

    // A /0 CIDR is not a narrow target: it covers everything, so it must go
    // through the same confirm=true gate as a broad filter or all=true.
    const totalScopeValue = normalizedScope === 'Range' && normalizedValue !== undefined && isTotalCidr(normalizedValue);
    const hasNarrowTarget = Boolean(
        (input.ip && !isTotalCidr(input.ip)) ||
        (input.range && !isTotalCidr(input.range)) ||
        (normalizedScope && normalizedValue && !totalScopeValue)
    );
    if (input.id === undefined && !hasNarrowTarget && input.confirm !== true) {
        throw new Error(
            'Deleting alerts filtered only by scenario, origin, type, time or has_active_decision requires confirm=true; add ip, range, or scope+value to narrow the target'
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

async function deleteAlertsByCidr(ctx: AppContext, filters: NormalizedDeleteAlertInput): Promise<string> {
    // The delete endpoint matches exact filter values; search first so alerts
    // whose decisions are contained in the range are also removed. Validated on
    // LAPI 1.8.1: alert ip/range filters match the decisions attached to the
    // alert, not the alert source.
    const query: APITypes.SearchAlertsQuery = {
        ip: filters.ip,
        range: filters.range,
        scope: filters.normalizedScope,
        value: filters.normalizedValue,
        scenario: filters.scenario,
        origin: filters.origin,
        decision_type: filters.decisionType,
        since: filters.since ? toGoDuration(filters.since) : undefined,
        until: filters.until ? toGoDuration(filters.until) : undefined,
        contains: false,
        has_active_decision: filters.has_active_decision,
        limit: 0
    };
    const alerts = await ctx.watcher!.Alerts.search(query);

    return deleteAlertsByIds(
        ctx,
        alerts
            .filter((alert) => alertMatchesDeleteFilters(alert, filters))
            .map((alert) => alert.id)
            .filter((id): id is number => typeof id === 'number')
    );
}

/**
 * True when the LAPI rejected a filter parameter on the DELETE endpoint.
 * Older releases reuse the alert filter for search but not for delete.
 */
function isUnknownFilterError(error: unknown, parameter: string): boolean {
    const code = (error as { code?: unknown } | undefined)?.code;
    if (code !== 500 && code !== 400) {
        return false;
    }

    const message = cleanErrorMessage(error);
    if (!new RegExp(`\\b${parameter}\\b`, 'i').test(message)) {
        return false;
    }

    return /(doesn'?t exist|unknown|invalid)[\s\S]{0,60}filter|filter[\s\S]{0,60}(doesn'?t exist|unknown|invalid)/i.test(message);
}

async function deleteAlertsBySearch(ctx: AppContext, filters: NormalizedDeleteAlertInput): Promise<string> {
    // Fallback for LAPIs that accept `decision_type` on the search filter but
    // not on the DELETE endpoint: search first, then delete by id.
    const query: APITypes.SearchAlertsQuery = {
        ip: filters.ip,
        range: filters.range,
        scope: filters.normalizedScope,
        value: filters.normalizedValue,
        scenario: filters.scenario,
        origin: filters.origin,
        decision_type: filters.decisionType,
        since: filters.since ? toGoDuration(filters.since) : undefined,
        until: filters.until ? toGoDuration(filters.until) : undefined,
        ...(filters.ip || filters.range ? { contains: false } : {}),
        has_active_decision: filters.has_active_decision,
        limit: 0
    };
    const alerts = await ctx.watcher!.Alerts.search(query);

    return deleteAlertsByIds(
        ctx,
        alerts
            .filter((alert) => alertMatchesDeleteFilters(alert, filters))
            .map((alert) => alert.id)
            .filter((id): id is number => typeof id === 'number')
    );
}

function buildDeleteQuery(filters: NormalizedDeleteAlertInput): APITypes.DeleteAlertsQuery {
    // Validated on CrowdSec 1.8.1: DeleteAlertWithFilter reuses the alert
    // filter. `alert_source` is rejected ("filter parameter 'alert_source' is
    // unknown"), while `origin`, `kind`, `contains` and `decision_type` are
    // accepted (`kind` is not exposed by this tool). `origin` filters the
    // origin of the decisions attached to the alert, not the alert kind.
    return {
        ip: filters.ip,
        scope: filters.normalizedScope,
        value: filters.normalizedValue,
        scenario: filters.scenario,
        since: filters.since ? toGoDuration(filters.since) : undefined,
        until: filters.until ? toGoDuration(filters.until) : undefined,
        // `contains` only exists from LAPI 1.0.3 and only matters with
        // ip/range. Without it, deleting an exact IP would also match Range
        // decisions that contain the IP.
        ...(filters.ip || filters.range ? { contains: false } : {}),
        decision_type: filters.decisionType,
        has_active_decision: filters.has_active_decision,
        origin: filters.origin
    };
}

async function deleteAlertsDirect(ctx: AppContext, filters: NormalizedDeleteAlertInput): Promise<string> {
    const result = await ctx.watcher!.Alerts.delete(buildDeleteQuery(filters));

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
        requires: ['alerts'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
            const { ip, range, scope, value, scenario, type, origin, kind, contains, since, until, has_active_decision, all, limit } =
                ListAlertsInput.parse(input);

            if (ip && !isValidIp(ip) && !isValidCidr(ip)) {
                throw new Error(`${ip} is not a valid ip or CIDR range`);
            }
            if (range) {
                assertValidCidr(range);
            }
            const normalizedScope = scope ? assertValidDecisionScope(scope) : undefined;
            const normalizedValue = normalizedScope && value ? assertValidScopeValue(normalizedScope, value) : value;
            const decisionType = type ? assertValidDecisionType(type) : undefined;
            if (since && !isValidTimeFilter(since)) {
                throw new Error(`invalid since '${since}': use h, m, s or d (e.g. 4h, 30d)`);
            }
            if (until && !isValidTimeFilter(until)) {
                throw new Error(`invalid until '${until}': use h, m, s or d (e.g. 4h, 30d)`);
            }

            const window = resolveListWindow(limit, all === true, ctx.config.maxResults);
            // Validated on CrowdSec 1.8.1: `ip`/`range` match alerts through
            // their decisions (alerts without decisions never match), `kind` is
            // case-sensitive, `origin` is the decision origin, and
            // `has_active_decision=false` means "no decisions at all".
            const query: APITypes.SearchAlertsQuery = {
                ip,
                range,
                scope: normalizedScope,
                value: normalizedValue,
                scenario,
                decision_type: decisionType,
                origin,
                kind,
                since: since ? toGoDuration(since) : undefined,
                until: until ? toGoDuration(until) : undefined,
                // Validated on CrowdSec 1.8.1: `contains` defaults to true; the
                // tool defaults to false so `ip=<cidr>` means "decisions inside
                // this CIDR". The option lets callers match decisions that
                // contain the value instead. Do not send it without ip/range:
                // the parameter does not exist before LAPI 1.0.3.
                ...(ip || range ? { contains } : {}),
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
        requires: ['alerts'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
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
            'Delete alerts by ID or filters. Requires at least one filter or all=true with confirm=true; all=true cannot be combined with filters. Broad filters (scenario, origin, type, time, has_active_decision alone) also require confirm=true; narrow with ip, range, or scope+value. ip and range accept a CIDR and perform containment. CrowdSec only allows alert deletion from the LAPI host; remote watchers receive 403.',
        inputSchema: DeleteAlertsInput,
        kind: 'write',
        requires: ['alerts'],
        feature: 'alert-delete',
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false
        },
        handler: async (input, ctx) => {
            const filters = normalizeDeleteInput(DeleteAlertsInput.parse(input));

            if (filters.id !== undefined) {
                return deleteAlertsById(ctx, filters.id);
            }
            if (filters.all === true) {
                return deleteAllAlerts(ctx);
            }

            const cidr = filters.range ?? (filters.ip && isValidCidr(filters.ip) ? filters.ip : undefined);
            if (cidr) {
                return deleteAlertsByCidr(ctx, filters);
            }

            if (filters.decisionType) {
                try {
                    return await deleteAlertsDirect(ctx, filters);
                } catch (error) {
                    // Older LAPIs reject `decision_type` on DELETE; fall back to
                    // the search + delete-by-id path that has always worked.
                    if (!isUnknownFilterError(error, 'decision_type')) {
                        throw error;
                    }
                    return deleteAlertsBySearch(ctx, filters);
                }
            }

            return deleteAlertsDirect(ctx, filters);
        }
    }
];
