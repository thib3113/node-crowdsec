import debug from 'debug';
import { z } from 'zod';
import { compareLapiVersions, FeatureNotSupportedError, parseLapiVersion } from 'crowdsec-client';
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
    isTotalCidr,
    isValidTimeFilter,
    mapWithConcurrency,
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

const log = debug('crowdsec-mcp:tools:decisions');

function collectDecisions(alerts: APITypes.GetAlertsResponse): APITypes.Decision[] {
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

const DELETE_CONCURRENCY = 8;

function isUnknownAlertFilter(error: unknown, parameter: string): boolean {
    const code = (error as { code?: unknown } | undefined)?.code;
    if (code !== 400 && code !== 500) {
        return false;
    }

    const message = cleanErrorMessage(error);
    if (!new RegExp(`\\b${parameter}\\b`, 'i').test(message)) {
        return false;
    }

    return /(doesn'?t exist|unknown|invalid)[\s\S]{0,60}filter|filter[\s\S]{0,60}(doesn'?t exist|unknown|invalid)/i.test(message);
}

/**
 * The alert `simulated` parameter is not available on every LAPI. When asking
 * to include simulated decisions, a rejected filter is retried without it
 * (narrower result) instead of failing the tool. A request to exclude them
 * (`simulated: false`) is never widened by dropping the filter.
 */
async function searchAlerts(ctx: AppContext, query: APITypes.SearchAlertsQuery): Promise<APITypes.Alert[]> {
    try {
        return await ctx.watcher!.Alerts.search(query);
    } catch (error) {
        if (query.simulated !== true || !isUnknownAlertFilter(error, 'simulated')) {
            throw error;
        }

        const withoutSimulated: APITypes.SearchAlertsQuery = { ...query };
        delete withoutSimulated.simulated;
        return ctx.watcher!.Alerts.search(withoutSimulated);
    }
}

async function deleteDecisionIds(ctx: AppContext, ids: number[]): Promise<number> {
    const results = await mapWithConcurrency(ids, DELETE_CONCURRENCY, (id) => ctx.watcher!.Decisions.deleteById(String(id)));
    return results.reduce((total, result) => total + Number(result.nbDeleted ?? 0), 0);
}

async function fetchActiveDecisions(ctx: AppContext): Promise<APITypes.Decision[]> {
    // Include simulated decisions: `list_decisions` shows them by default, so
    // `all=true` must delete the same set the operator just listed.
    const alerts = await searchAlerts(ctx, { has_active_decision: true, simulated: true, limit: 0 });
    return collectDecisions(alerts);
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
        no_simulated: z
            .boolean()
            .optional()
            .default(false)
            .describe('Exclude simulated decisions (recorded but not enforced). Default false includes them.'),
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
        ip: z
            .string()
            .optional()
            .describe(
                'Single IP: deletes only decisions contained at/below this IP. A Range decision that contains the IP is kept; use range for containment.'
            ),
        range: z.string().optional().describe('CIDR range: deletes decisions contained within it (server-side filter).'),
        scope: z
            .string()
            .optional()
            .describe('Scope to filter by (must be combined with value). Non-IP scopes use the LAPI scopes filter.'),
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

/** Allowlists need LAPI 1.6.6: a missing route must not block a ban. */
function isAllowlistUnavailable(error: unknown): boolean {
    if (error instanceof FeatureNotSupportedError) {
        return true;
    }
    const code = (error as { code?: unknown } | undefined)?.code;
    return code === 404 || code === 405;
}

async function ensureBanAllowed(ctx: AppContext, scope: string, targetValue: string, force: boolean): Promise<void> {
    if (force || (scope !== 'Ip' && scope !== 'Range')) {
        return;
    }

    let checkResult: APITypes.CheckAllowlistResponse;
    try {
        checkResult = await ctx.allowlists.check(targetValue);
    } catch (error) {
        if (isAllowlistUnavailable(error)) {
            // Older LAPI: no allowlist endpoint. Continue without the
            // pre-check rather than refusing every ban.
            return;
        }
        throw error;
    }

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

function buildUnbanQuery(input: UnbanInput, type: string | undefined): UnbanQuery {
    const query: UnbanQuery = {};
    if (input.ip) {
        query.ip = input.ip;
        // Validated on CrowdSec 1.8.1: the delete filter defaults contains to
        // true, so `?ip=...` also expires Range decisions containing the IP.
        // `contains=false` limits the delete to decisions contained within the
        // value (the exact IP, and anything nested inside it).
        query.contains = false;
    }
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
        return unbanByQuery(ctx, { ip: normalizedValue, type, scenario, contains: false });
    }
    if (normalized === 'Range') {
        // Validated on CrowdSec 1.8.1: ExpireDecisionsWithFilter supports
        // `range` + `contains=false` + `type` + `scenario` server-side. Deleting
        // via an alert search then by ID would also collect decisions of the
        // same alert that are outside the range.
        return unbanByQuery(ctx, { range: normalizedValue, type, scenario, contains: false });
    }

    // Validated on CrowdSec 1.8.1: `scope` is rejected by the decision delete
    // filter with "'scope' doesn't exist: invalid filter"; `scopes` (plural) is
    // the supported parameter.
    return unbanByQuery(ctx, { scopes: normalized, value: normalizedValue, type, scenario });
}

async function unbanByRange(ctx: AppContext, range: string, type: string | undefined, scenario: string | undefined): Promise<string> {
    // Same as scope=Range: the LAPI filters decisions contained in the range.
    return unbanByQuery(ctx, { range, type, scenario, contains: false });
}

interface UnbanQuery {
    ip?: string;
    range?: string;
    scopes?: string;
    value?: string;
    type?: string;
    scenario?: string;
    contains?: boolean;
}

/**
 * True when the delete filter was rejected by the LAPI or the client guard.
 * Such a failure happens while parsing the filter, before any row is deleted,
 * so replaying it as a search + delete-by-id is safe.
 */
function shouldFallbackToSearch(error: unknown): boolean {
    if (error instanceof FeatureNotSupportedError) {
        return true;
    }

    const code = (error as { code?: unknown } | undefined)?.code;
    if (code !== 400 && code !== 500) {
        return false;
    }

    return /(doesn'?t exist|unknown|invalid)[\s\S]{0,60}filter|filter[\s\S]{0,60}(doesn'?t exist|unknown|invalid)/i.test(
        cleanErrorMessage(error)
    );
}

/**
 * Keep only the decisions the requested filter would have deleted.
 *
 * The alert search returns whole alerts, and an alert can carry decisions for
 * other values, types or scenarios. Deleting every decision of a matching alert
 * would widen the operation, so the fallback is deliberately conservative:
 * decisions are matched by exact scope/value (never by CIDR containment) and
 * by type/scenario equality. It may leave a nested decision behind on an old
 * LAPI, but it never deletes a decision the filter did not target.
 */
function decisionMatchesUnbanQuery(decision: APITypes.Decision, query: UnbanQuery): boolean {
    if (query.type && decision.type?.toLowerCase() !== query.type.toLowerCase()) {
        return false;
    }

    if (query.scenario && decision.scenario?.toLowerCase() !== query.scenario.toLowerCase()) {
        return false;
    }

    // `normalizeScope(undefined)` defaults to Ip, which would let an incomplete
    // decision match an IP filter. Require an explicit scope instead.
    const decisionScope = decision.scope ? normalizeScope(decision.scope) : undefined;

    if (query.scopes !== undefined) {
        return query.value !== undefined && decisionScope === normalizeScope(query.scopes) && decision.value === query.value;
    }

    if (query.ip) {
        return decisionScope === 'Ip' && decision.value === query.ip;
    }

    if (query.range) {
        return decisionScope === 'Range' && decision.value === query.range;
    }

    // A bare value is not a valid unban filter; never widen to every decision.
    return query.value === undefined;
}

/** Smallest-version fallback: search alerts, then delete the matching decisions by id. */
async function unbanBySearch(ctx: AppContext, query: UnbanQuery): Promise<string> {
    // `scope`/`value` on the alert search filters the alert source, not the
    // decisions attached to it. A non-IP scope decision (Country, AS, ...)
    // attached to a different alert source would be silently missed, so refuse
    // rather than under-delete.
    if (query.scopes !== undefined) {
        throw new Error(
            'Cannot safely resolve a non-IP scope unban on this LAPI: the alert fallback cannot match decision scopes. ' +
                'Delete by decision id or upgrade the LAPI.'
        );
    }

    // With a known-unsupported `contains`, the alert search would either fail
    // or silently ignore the narrowing and return a wider set. Refuse instead
    // of risking a deletion the filter did not intend.
    if ((query.ip || query.range) && ctx.watcher?.supports('containsFilter') === false) {
        throw new Error(
            'Cannot safely resolve this unban on this LAPI: the contains filter requires CrowdSec 1.0.3 or newer. ' +
                'Delete by decision id, shorten the decision duration, or upgrade the LAPI.'
        );
    }

    const search: APITypes.SearchAlertsQuery = {
        ip: query.ip,
        range: query.range,
        scope: query.scopes,
        value: query.value,
        decision_type: query.type,
        scenario: query.scenario,
        ...(query.ip || query.range ? { contains: false } : {}),
        // Match the bouncer/direct paths, which can also target simulated
        // decisions; the alert search excludes them unless asked.
        simulated: true,
        has_active_decision: true,
        limit: 0
    };
    const alerts = await searchAlerts(ctx, search);
    const ids = collectDecisions(alerts)
        .filter((decision) => decisionMatchesUnbanQuery(decision, query))
        .map((decision) => decision.id)
        .filter((id): id is number => typeof id === 'number');

    return formatUnbanResult(await deleteDecisionIds(ctx, ids));
}

async function unbanByQuery(ctx: AppContext, query: UnbanQuery) {
    if (!query.ip && !query.range && !query.scopes && !query.value && !query.type && !query.scenario) {
        throw new Error('Must provide id, at least one filter, or all=true with confirm=true');
    }

    try {
        const result = await ctx.watcher!.Decisions.delete(query);
        return formatUnbanResult(result.nbDeleted ?? 0);
    } catch (error) {
        if (!shouldFallbackToSearch(error)) {
            throw error;
        }

        log('decision delete rejected (%s), falling back to the alert search', cleanErrorMessage(error));
        return unbanBySearch(ctx, query);
    }
}

/**
 * `GET /v1/decisions` honours `scope` before 1.3.3 and from 1.6.1, but ignores
 * it on 1.3.3-1.6.0. Without a declared version we cannot tell, so a scope
 * filter through the bouncer path is refused instead of silently widened.
 */
function bouncerScopeFilterIsReliable(lapiVersion: string | undefined): boolean {
    if (!lapiVersion || parseLapiVersion(lapiVersion) === null) {
        return false;
    }

    return compareLapiVersions(lapiVersion, '1.3.3') < 0 || compareLapiVersions(lapiVersion, '1.6.1') >= 0;
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
        description:
            'List active decisions from CrowdSec. Works in both bouncer and watcher modes. With both credentials the bouncer path is used by default, where `scenario` is a substring match; `since`/`until` and `scope` force the watcher alert scan. Mirrors `cscli decisions list`.',
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

            // `since`/`until` filter alerts, not decisions: they only work on
            // the watcher path. The bouncer endpoint always returns the full
            // decision set, so prefer it whenever those filters are absent.
            const needsAlertWindow = Boolean(normalizedSince || normalizedUntil);

            // `/v1/decisions` silently ignores `scope` on LAPI 1.3.3-1.6.0,
            // which would widen the result. When a watcher is available, use
            // the alert path, whose `scope` filter is reliable.
            const scopeNeedsWatcher = normalizedScope !== undefined && ctx.watcher !== undefined;

            if (normalizedScope !== undefined && !ctx.watcher && !bouncerScopeFilterIsReliable(ctx.config.lapiVersion)) {
                throw new Error(
                    'scope filtering requires watcher credentials because /v1/decisions ignores it on some LAPI versions; add CROWDSEC_MACHINE_ID/CROWDSEC_PASSWORD or declare a compatible CROWDSEC_LAPI_VERSION'
                );
            }

            if (ctx.bouncer && !needsAlertWindow && !scopeNeedsWatcher) {
                try {
                    await ctx.ensureReady('bouncer');
                    const decisions = await ctx.bouncer.Decisions.search({
                        ip,
                        range,
                        scope: normalizedScope,
                        value: normalizedValue,
                        type: decisionType,
                        origins: origin,
                        scenarios_containing: scenario,
                        // Validated on CrowdSec 1.8.1: the decision filter
                        // excludes simulated decisions by default and does not
                        // return the `simulated` field. `simulated: true`
                        // includes both, which preserves the watcher default
                        // (`no_simulated=false`).
                        simulated: !no_simulated,
                        ...(ip || range ? { contains } : {})
                    });

                    return formatBouncerDecisionList(decisions, window.displayLimit);
                } catch (error) {
                    // A broken bouncer key must not hide a healthy watcher, but
                    // keep the original failure visible in the debug log.
                    if (!ctx.watcher) {
                        throw error;
                    }
                    log('bouncer decision search failed, falling back to the watcher: %s', cleanErrorMessage(error));
                }
            }

            if (ctx.watcher) {
                await ctx.ensureReady('watcher');
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
                    simulated: !no_simulated,
                    // `contains` only exists from LAPI 1.0.3 and is only
                    // meaningful with ip/range (docs/api-compatibility.md).
                    ...(ip || range ? { contains } : {}),
                    has_active_decision: true,
                    limit: window.fetchLimit
                };

                const alerts = await searchAlerts(ctx, query);
                const rendered = formatDecisionList(alerts, window.displayLimit, window.maybeMore);

                if (!ctx.capabilities.decisionsFast) {
                    return `${rendered}\n\n_Bouncer credentials (CROWDSEC_API_KEY) would make this scan about 60x faster._`;
                }
                return rendered;
            }

            if (needsAlertWindow) {
                throw new Error(
                    'since/until filter alerts and require watcher credentials; add CROWDSEC_MACHINE_ID/CROWDSEC_PASSWORD or drop those filters'
                );
            }

            throw new Error('No decision client available');
        }
    },
    {
        name: 'get_decision',
        title: 'Get decision details',
        description:
            'Get an active decision by ID. The watcher path also includes the alert context; with a bouncer key the decision is found in the fast decision list.',
        inputSchema: GetDecisionInput,
        kind: 'read',
        annotations: { readOnlyHint: true, idempotentHint: true },
        handler: async (input, ctx) => {
            const { id } = GetDecisionInput.parse(input);
            const decisionId = parsePositiveId(id, 'decision id');

            let watcherError: unknown;

            if (ctx.watcher) {
                try {
                    await ctx.ensureReady('watcher');
                    // The LAPI exposes no decision lookup by id: this full scan
                    // is the price of returning the alert context. The bouncer
                    // path below is cheaper but only has the decision itself.
                    const alerts = await searchAlerts(ctx, { has_active_decision: true, simulated: true, limit: 0 });

                    for (const alert of alerts) {
                        const decision = (alert.decisions ?? []).find((candidate) => candidate.id === Number(decisionId));
                        if (decision) {
                            return formatDecisionDetail(decision, alert);
                        }
                    }
                } catch (error) {
                    if (!ctx.bouncer) {
                        throw error;
                    }
                    // The bouncer can still satisfy the lookup when the watcher
                    // is unavailable or the decision has no local alert.
                    watcherError = error;
                }
            }

            if (ctx.bouncer) {
                await ctx.ensureReady('bouncer');
                // Include simulated decisions so the lookup matches the
                // watcher path; the bouncer endpoint excludes them by default.
                // `/v1/decisions` has no id filter, so this downloads the
                // active decision set and filters locally.
                const decisions = await ctx.bouncer.Decisions.search({ simulated: true });
                const decision = decisions.find((candidate) => candidate.id === Number(decisionId));
                if (decision) {
                    return formatDecisionDetail(decision);
                }
            }

            if (watcherError) {
                throw watcherError;
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
        requires: ['write'],
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
        requires: ['write'],
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

            // /0 covers every decision; require the same explicit confirmation
            // as a broad type/scenario delete. `scope=Range`+`value` reaches the
            // same delete path, so it must be checked too.
            const trimmedScopeValue = unbanInput.value?.trim();
            const totalScopeValue =
                unbanInput.scope !== undefined &&
                trimmedScopeValue !== undefined &&
                normalizeScope(unbanInput.scope) === 'Range' &&
                isValidCidr(trimmedScopeValue) &&
                isTotalCidr(trimmedScopeValue);
            const totalCidr = Boolean(
                (unbanInput.ip && isTotalCidr(unbanInput.ip)) || (unbanInput.range && isTotalCidr(unbanInput.range)) || totalScopeValue
            );
            if (totalCidr && unbanInput.confirm !== true) {
                throw new Error(
                    'Deleting decisions for a /0 range requires confirm=true; narrow the range or use all=true with confirm=true'
                );
            }

            const hasNarrowTarget = Boolean(
                (unbanInput.ip && !isTotalCidr(unbanInput.ip)) ||
                (unbanInput.range && !isTotalCidr(unbanInput.range)) ||
                (unbanInput.scope && unbanInput.value && !totalScopeValue)
            );
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
