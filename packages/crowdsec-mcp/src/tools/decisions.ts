import { z } from 'zod';
import type { APITypes } from 'crowdsec-client';
import {
    assertValidCidr,
    assertValidDecisionScope,
    assertValidDecisionType,
    assertValidIp,
    assertValidScopeValue,
    formatDuration,
    isValidCidr,
    isValidIp,
    isValidTimeFilter,
    normalizeScope,
    parseDuration,
    parsePositiveId,
    resolveListWindow,
    toGoDuration
} from '../utils.js';
import {
    formatBanResult,
    formatBouncerDecisionList,
    formatDecisionDetail,
    formatDecisionList,
    formatUnbanResult
} from '../format/decisions.js';
import { cleanErrorMessage } from '../registry.js';
import type { AppContext, ToolDefinition } from '../types.js';

function collectDecisionIds(alerts: APITypes.GetAlertsResponse): number[] {
    const ids = new Set<number>();
    for (const alert of alerts) {
        for (const decision of alert.decisions ?? []) {
            if (typeof decision.id === 'number') {
                ids.add(decision.id);
            }
        }
    }
    return [...ids];
}

async function searchActiveDecisionIds(ctx: AppContext, query: APITypes.SearchAlertsQuery): Promise<number[]> {
    // `contains: false` means "decisions contained within the value" and is
    // required for CIDR containment; the LAPI defaults to the opposite.
    const searchQuery: APITypes.SearchAlertsQuery = {
        ...query,
        contains: query.contains ?? false,
        has_active_decision: true,
        limit: 0
    };
    const alerts = await ctx.watcher!.Alerts.search(searchQuery);
    return collectDecisionIds(alerts);
}

async function deleteDecisionIds(ctx: AppContext, ids: number[]): Promise<number> {
    const results = await Promise.all(ids.map((id) => ctx.watcher!.Decisions.deleteById(String(id))));
    return results.reduce((total, result) => total + Number(result.nbDeleted ?? 0), 0);
}

async function fetchActiveDecisions(ctx: AppContext): Promise<APITypes.Decision[]> {
    const alerts = await ctx.watcher!.Alerts.search({ has_active_decision: true, limit: 0 });
    const decisions = new Map<number, APITypes.Decision>();
    for (const alert of alerts) {
        for (const decision of alert.decisions ?? []) {
            if (typeof decision.id === 'number') {
                decisions.set(decision.id, decision);
            }
        }
    }
    return [...decisions.values()];
}

const ListDecisionsInput = z
    .object({
        ip: z.string().optional().describe('IP or CIDR range to filter by (CIDR performs containment)'),
        range: z.string().optional().describe('CIDR range to filter by (shorthand for scope=Range)'),
        scope: z.string().optional().describe('Scope to filter by (Ip, Range, Username, Session, Country, AS)'),
        value: z.string().optional().describe('Value to filter by (used with scope)'),
        type: z.string().optional().describe('Decision type to filter by (ban, captcha, etc.)'),
        origin: z.string().optional().describe('Origin to filter by (cscli, crowdsec, capi, console, etc.)'),
        scenario: z.string().optional().describe('Scenario name to filter by'),
        since: z.string().optional().describe('Show alerts newer than this duration (e.g., 24h, 7d, 3650d)'),
        until: z.string().optional().describe('Show alerts older than this duration (e.g., 24h, 7d, 3650d)'),
        contains: z
            .boolean()
            .optional()
            .default(false)
            .describe('false: decisions contained within the value (CIDR containment); true: decisions that contain the value'),
        no_simulated: z.boolean().optional().default(false).describe('Exclude simulated decisions'),
        all: z.boolean().optional().default(false).describe('Return all results without limit'),
        limit: z.number().int().positive().optional().describe('Maximum number of results to return')
    })
    .strict();

const BanIpInput = z
    .object({
        ip: z.string().optional().describe('IP address to ban (shorthand for scope=Ip)'),
        range: z.string().optional().describe('CIDR range to ban (shorthand for scope=Range)'),
        scope: z.string().optional().describe('Scope of the decision (Ip, Range, Username, Session, Country, AS)'),
        value: z.string().optional().describe('Value of the decision scope (used with scope)'),
        duration: z
            .union([z.string(), z.number()])
            .optional()
            .default('4h')
            .describe('Duration of the ban with a unit (e.g., 4h, 30m, 7d)'),
        type: z.string().optional().default('ban').describe('Type of decision (ban, captcha, etc.)'),
        reason: z.string().optional().describe('Reason for the ban'),
        force: z.boolean().optional().default(false).describe('Force the ban even if the IP/range is allowlisted or exceeds max duration')
    })
    .strict();

const GetDecisionInput = z
    .object({
        id: z.union([z.string(), z.number()]).describe('Decision ID')
    })
    .strict();

const UnbanIpInput = z
    .object({
        id: z.union([z.string(), z.number()]).optional().describe('Decision ID to delete'),
        ip: z.string().optional().describe('Single IP address to filter by (exact match)'),
        range: z.string().optional().describe('CIDR value for decisions whose scope is Range (exact match)'),
        scope: z.string().optional().describe('Scope to filter by (must be combined with value)'),
        value: z.string().optional().describe('Value to filter by (used with scope)'),
        type: z.string().optional().describe('Decision type to filter by (ban, captcha, throttle)'),
        scenario: z.string().optional().describe('Scenario name to filter by'),
        all: z.boolean().optional().default(false).describe('Delete all matching decisions'),
        confirm: z
            .boolean()
            .optional()
            .default(false)
            .describe('Confirm deletion when all=true or when only type/scenario filters are used')
    })
    .strict();

type BanInput = z.infer<typeof BanIpInput>;
type UnbanInput = z.infer<typeof UnbanIpInput>;

function validateBanTarget(input: BanInput): void {
    const hasIp = Boolean(input.ip);
    const hasRange = Boolean(input.range);
    const hasScope = Boolean(input.scope);
    const hasValue = Boolean(input.value);

    if ((hasIp || hasRange) && (hasScope || hasValue)) {
        throw new Error('Provide only one of ip, range, or scope+value');
    }
    if (hasIp && hasRange) {
        throw new Error('Provide only one of ip, range, or scope+value');
    }
    if (hasScope !== hasValue) {
        throw new Error('scope and value must be provided together');
    }
    if (!hasIp && !hasRange && !hasScope) {
        throw new Error('Must provide ip, range, or scope+value');
    }
}

function resolveBanTarget(input: BanInput): { scope: string; targetValue: string } {
    if (input.ip) {
        return { scope: normalizeScope(undefined, input.ip), targetValue: input.ip };
    }
    if (input.range) {
        return { scope: normalizeScope(undefined, undefined, input.range), targetValue: input.range };
    }

    const scope = assertValidDecisionScope(input.scope!);
    return { scope, targetValue: assertValidScopeValue(scope, input.value!) };
}

async function ensureBanAllowed(ctx: AppContext, scope: string, targetValue: string, force: boolean): Promise<void> {
    if (force || (scope !== 'Ip' && scope !== 'Range')) {
        return;
    }

    const checkResult = await ctx.allowlists.check(targetValue);
    if (checkResult.allowlisted) {
        const suffix = checkResult.reason ? ` by item ${checkResult.reason}` : '';
        throw new Error(`${targetValue} is allowlisted${suffix}, use force=true to add the decision anyway`);
    }
}

function ensureBanDuration(ctx: AppContext, duration: string, durationSeconds: number, force: boolean): void {
    if (force || durationSeconds <= ctx.config.maxBanDurationSeconds) {
        return;
    }

    const maxDuration = formatDuration(ctx.config.maxBanDurationSeconds);
    throw new Error(`Duration ${duration} exceeds maximum allowed ${maxDuration}. Use force=true to override.`);
}

function buildBanAlert(decisionType: string, scope: string, targetValue: string, duration: string, reason: string) {
    const now = new Date().toISOString();

    return {
        capacity: 0,
        decisions: [
            {
                origin: 'cscli',
                type: decisionType,
                scope,
                value: targetValue,
                duration,
                scenario: reason
            }
        ],
        events: [],
        events_count: 1,
        leakspeed: '0',
        message: reason,
        scenario: reason,
        scenario_hash: '',
        scenario_version: '',
        simulated: false,
        source: {
            scope,
            value: targetValue,
            ip: scope === 'Ip' ? targetValue : '',
            range: scope === 'Range' ? targetValue : '',
            as_name: '',
            as_number: '',
            cn: ''
        },
        start_at: now,
        stop_at: now,
        created_at: now,
        remediation: true,
        kind: 'cscli'
    };
}

function validateUnbanTargets(ip?: string, range?: string, scope?: string, value?: string): void {
    if (ip && range) {
        throw new Error('Provide only one of ip or range');
    }
    if ((scope || value) && (ip || range)) {
        throw new Error('Provide only one of ip, range, or scope+value');
    }
    if (Boolean(scope) !== Boolean(value)) {
        throw new Error('scope and value must be provided together');
    }
}

function assertUnbanIdHasNoFilters(input: UnbanInput): void {
    if (input.ip || input.range || input.scope || input.value || input.type || input.scenario) {
        throw new Error('Cannot combine id with filters');
    }
}

function buildUnbanQuery(input: UnbanInput, type: string | undefined): { ip?: string; value?: string; type?: string; scenario?: string } {
    const query: { ip?: string; value?: string; type?: string; scenario?: string } = {};
    if (input.ip) query.ip = input.ip;
    if (input.value) query.value = input.value;
    if (type) query.type = type;
    if (input.scenario) query.scenario = input.scenario;
    return query;
}

async function unbanDecisionIds(ctx: AppContext, ids: number[]): Promise<string> {
    if (ids.length === 0) {
        return formatUnbanResult(0);
    }
    return formatUnbanResult(await deleteDecisionIds(ctx, ids));
}

async function unbanAll(ctx: AppContext, input: UnbanInput): Promise<string> {
    if (!input.confirm) {
        throw new Error('Deleting all decisions requires confirm=true');
    }
    if (input.id !== undefined || input.ip || input.range || input.scope || input.value || input.type || input.scenario) {
        throw new Error('Cannot combine all=true with id or filters; use all=true with confirm=true alone to delete everything');
    }

    const decisions = await fetchActiveDecisions(ctx);
    const ids = decisions.map((decision) => decision.id).filter((id): id is number => typeof id === 'number');
    return unbanDecisionIds(ctx, ids);
}

async function unbanById(ctx: AppContext, id: string | number): Promise<string> {
    const decisionId = parsePositiveId(id, 'decision id');

    try {
        const result = await ctx.watcher!.Decisions.deleteById(decisionId);
        const nbDeleted = Number(result.nbDeleted ?? 0);
        if (nbDeleted === 0) {
            throw new Error(`Decision ${decisionId} not found`);
        }
        return formatUnbanResult(nbDeleted);
    } catch (error) {
        const message = cleanErrorMessage(error);
        if (/not found|doesn't exist/i.test(message)) {
            throw new Error(`Decision ${decisionId} not found`);
        }
        throw error;
    }
}

async function unbanByScopeValue(
    ctx: AppContext,
    scope: string,
    value: string,
    type: string | undefined,
    scenario: string | undefined
): Promise<string> {
    const normalized = assertValidDecisionScope(scope);
    const normalizedValue = assertValidScopeValue(normalized, value);

    if (normalized === 'Ip') {
        return unbanByQuery(ctx, { ip: normalizedValue, type, scenario });
    }
    if (normalized === 'Range') {
        // The delete endpoint matches the exact range value; search first so
        // decisions for individual IPs inside the range are also removed.
        const ids = await searchActiveDecisionIds(ctx, { ip: normalizedValue, decision_type: type, scenario });
        return unbanDecisionIds(ctx, ids);
    }

    return unbanByQuery(ctx, { scope: normalized, value: normalizedValue, type, scenario });
}

async function unbanByRange(ctx: AppContext, range: string, type: string | undefined, scenario: string | undefined): Promise<string> {
    // Same as scope=Range: containment requires an alert search to collect IDs.
    const ids = await searchActiveDecisionIds(ctx, { ip: range, decision_type: type, scenario });
    return unbanDecisionIds(ctx, ids);
}

interface UnbanQuery {
    ip?: string;
    scope?: string;
    value?: string;
    type?: string;
    scenario?: string;
}

async function unbanByQuery(ctx: AppContext, query: UnbanQuery) {
    if (!query.ip && !query.scope && !query.value && !query.type && !query.scenario) {
        throw new Error('Must provide id, at least one filter, or all=true with confirm=true');
    }

    const result = await ctx.watcher!.Decisions.delete(query);
    return formatUnbanResult(result.nbDeleted ?? 0);
}

type ListDecisionsFilters = z.infer<typeof ListDecisionsInput>;

interface NormalizedListDecisionsFilters {
    scope?: string;
    value?: string;
}

function normalizeListDecisionsFilters(input: ListDecisionsFilters): NormalizedListDecisionsFilters {
    if (input.ip && !isValidIp(input.ip) && !isValidCidr(input.ip)) {
        throw new Error(`${input.ip} is not a valid ip or CIDR range`);
    }
    if (input.range) {
        assertValidCidr(input.range);
    }
    const scope = input.scope ? assertValidDecisionScope(input.scope) : undefined;
    const value = scope && input.value ? assertValidScopeValue(scope, input.value) : input.value;
    if (input.since && !isValidTimeFilter(input.since)) {
        throw new Error(`invalid since '${input.since}': use h, m, s or d (e.g. 4h, 30d)`);
    }
    if (input.until && !isValidTimeFilter(input.until)) {
        throw new Error(`invalid until '${input.until}': use h, m, s or d (e.g. 4h, 30d)`);
    }
    return { scope, value };
}

export const decisionTools: ToolDefinition[] = [
    {
        name: 'list_decisions',
        title: 'List Decisions',
        description: 'List active decisions from CrowdSec. Works in both bouncer and watcher modes. Mirrors `cscli decisions list`.',
        inputSchema: ListDecisionsInput,
        kind: 'read',
        annotations: { readOnlyHint: true, idempotentHint: true },
        handler: async (input, ctx) => {
            const parsed = ListDecisionsInput.parse(input);
            const { scope: normalizedScope, value: normalizedValue } = normalizeListDecisionsFilters(parsed);
            const { ip, range, type, origin, scenario, since, until, contains, no_simulated, all, limit } = parsed;
            const decisionType = type ? assertValidDecisionType(type) : undefined;
            const window = resolveListWindow(limit, all, ctx.config.maxResults);
            const normalizedSince = since ? toGoDuration(since) : undefined;
            const normalizedUntil = until ? toGoDuration(until) : undefined;

            if (ctx.mode === 'watcher' && ctx.watcher) {
                const query: APITypes.SearchAlertsQuery = {
                    ip,
                    range,
                    scope: normalizedScope,
                    value: normalizedValue,
                    scenario,
                    decision_type: decisionType,
                    origin,
                    since: normalizedSince,
                    until: normalizedUntil,
                    simulated: no_simulated ? false : undefined,
                    contains,
                    has_active_decision: true,
                    limit: window.fetchLimit
                };

                const alerts = await ctx.watcher.Alerts.search(query);

                return formatDecisionList(alerts, window.displayLimit, window.maybeMore);
            }

            if (ctx.mode === 'bouncer' && ctx.bouncer) {
                const decisions = await ctx.bouncer.Decisions.search({
                    ip,
                    range,
                    scope: normalizedScope,
                    value: normalizedValue,
                    type: decisionType,
                    origins: origin,
                    scenarios_containing: scenario,
                    contains
                });

                return formatBouncerDecisionList(decisions, window.displayLimit);
            }

            throw new Error('No client available for the current mode');
        }
    },
    {
        name: 'get_decision',
        title: 'Get decision details',
        description: 'Get an active decision by ID, including its alert context. Requires watcher mode.',
        inputSchema: GetDecisionInput,
        kind: 'read',
        requires: ['watcher'],
        annotations: { readOnlyHint: true, idempotentHint: true },
        handler: async (input, ctx) => {
            if (!ctx.watcher) {
                throw new Error('Watcher client not available');
            }

            const { id } = GetDecisionInput.parse(input);
            const decisionId = parsePositiveId(id, 'decision id');
            const alerts = await ctx.watcher.Alerts.search({ has_active_decision: true, limit: 0 });

            for (const alert of alerts) {
                const decision = (alert.decisions ?? []).find((candidate) => candidate.id === Number(decisionId));
                if (decision) {
                    return formatDecisionDetail(decision, alert);
                }
            }

            throw new Error(`Decision ${decisionId} not found`);
        }
    },
    {
        name: 'ban_ip',
        title: 'Ban IP',
        description:
            'Add a new decision (ban, captcha, etc.) for an IP, range, or other scope. Requires watcher mode. Mirrors `cscli decisions add`.',
        inputSchema: BanIpInput,
        kind: 'write',
        requires: ['watcher'],
        annotations: { readOnlyHint: false, destructiveHint: true },
        handler: async (input, ctx) => {
            if (!ctx.watcher) {
                throw new Error('Watcher client not available');
            }

            const banInput = BanIpInput.parse(input);
            validateBanTarget(banInput);

            const decisionType = assertValidDecisionType(banInput.type);
            const { scope, targetValue } = resolveBanTarget(banInput);
            const normalizedDuration = toGoDuration(banInput.duration);
            const durationSeconds = typeof banInput.duration === 'number' ? banInput.duration : parseDuration(banInput.duration);

            await ensureBanAllowed(ctx, scope, targetValue, banInput.force);
            ensureBanDuration(ctx, normalizedDuration, durationSeconds, banInput.force);

            const alertReason = banInput.reason?.trim() ? banInput.reason : `manual '${decisionType}' from 'crowdsec-mcp'`;
            const alert = buildBanAlert(decisionType, scope, targetValue, normalizedDuration, alertReason);
            const alertIds = await ctx.watcher.Alerts.pushAlerts([alert]);

            return formatBanResult(alertIds, {
                scope,
                value: targetValue,
                type: decisionType,
                duration: normalizedDuration,
                reason: alertReason
            });
        }
    },
    {
        name: 'unban_ip',
        title: 'Unban IP',
        description:
            'Delete decisions by ID or filters. Requires watcher mode. Broad type/scenario-only filters require confirm=true. Mirrors `cscli decisions delete`.',
        inputSchema: UnbanIpInput,
        kind: 'write',
        requires: ['watcher'],
        annotations: { readOnlyHint: false, destructiveHint: true },
        handler: async (input, ctx) => {
            if (!ctx.watcher) {
                throw new Error('Watcher client not available');
            }

            const unbanInput = UnbanIpInput.parse(input);

            if (unbanInput.all) {
                return unbanAll(ctx, unbanInput);
            }

            if (unbanInput.id !== undefined) {
                assertUnbanIdHasNoFilters(unbanInput);
                return unbanById(ctx, unbanInput.id);
            }

            validateUnbanTargets(unbanInput.ip, unbanInput.range, unbanInput.scope, unbanInput.value);

            if (unbanInput.ip) {
                assertValidIp(unbanInput.ip);
            }
            if (unbanInput.range) {
                assertValidCidr(unbanInput.range);
            }

            const normalizedType = unbanInput.type ? assertValidDecisionType(unbanInput.type) : undefined;

            const hasNarrowTarget = Boolean(unbanInput.ip || unbanInput.range || (unbanInput.scope && unbanInput.value));
            if (!hasNarrowTarget && (normalizedType || unbanInput.scenario) && unbanInput.confirm !== true) {
                throw new Error(
                    'Deleting decisions filtered only by type/scenario requires confirm=true; add ip, range, or scope+value to narrow the target'
                );
            }

            if (unbanInput.scope && unbanInput.value) {
                return unbanByScopeValue(ctx, unbanInput.scope, unbanInput.value, normalizedType, unbanInput.scenario);
            }
            if (unbanInput.range) {
                return unbanByRange(ctx, unbanInput.range, normalizedType, unbanInput.scenario);
            }

            return unbanByQuery(ctx, buildUnbanQuery(unbanInput, normalizedType));
        }
    }
];
