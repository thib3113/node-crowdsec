import { z } from 'zod';
import type { APITypes } from 'crowdsec-client';
import { parseDuration, formatDuration, normalizeScope } from '../utils.js';
import { formatDecisionList, formatBouncerDecisionList, formatBanResult, formatUnbanResult } from '../format/decisions.js';
import type { ToolDefinition } from '../types.js';

const ListDecisionsInput = z.object({
    ip: z.string().optional().describe('IP address to filter by (shorthand for scope=Ip)'),
    range: z.string().optional().describe('CIDR range to filter by (shorthand for scope=Range)'),
    scope: z.string().optional().describe('Scope to filter by (Ip, Range, Username, Session, Country, AS)'),
    value: z.string().optional().describe('Value to filter by (used with scope)'),
    type: z.string().optional().describe('Decision type to filter by (ban, captcha, etc.)'),
    origin: z.string().optional().describe('Origin to filter by (cscli, crowdsec, capi, console, etc.)'),
    scenario: z.string().optional().describe('Scenario name to filter by'),
    since: z.string().optional().describe('Show alerts newer than this duration (e.g., 24h, 7d)'),
    until: z.string().optional().describe('Show alerts older than this duration (e.g., 24h, 7d)'),
    contains: z.boolean().optional().default(false).describe('Search for decisions containing the value or contained within the value'),
    no_simulated: z.boolean().optional().default(false).describe('Exclude simulated decisions'),
    all: z.boolean().optional().default(false).describe('Return all results without limit'),
    limit: z.number().int().positive().optional().describe('Maximum number of results to return')
});

const BanIpInput = z.object({
    ip: z.string().optional().describe('IP address to ban (shorthand for scope=Ip)'),
    range: z.string().optional().describe('CIDR range to ban (shorthand for scope=Range)'),
    scope: z.string().optional().describe('Scope of the decision (Ip, Range, Username, Session, Country, AS)'),
    value: z.string().optional().describe('Value of the decision scope (used with scope)'),
    duration: z.string().optional().default('4h').describe('Duration of the ban (e.g., 4h, 30m, 7d)'),
    type: z.string().optional().default('ban').describe('Type of decision (ban, captcha, etc.)'),
    reason: z.string().optional().describe('Reason for the ban'),
    force: z.boolean().optional().default(false).describe('Force the ban even if the IP/range is allowlisted or exceeds max duration')
});

const UnbanIpInput = z.object({
    id: z.union([z.string(), z.number()]).optional().describe('Decision ID to delete'),
    ip: z.string().optional().describe('IP address to filter by (shorthand for scope=Ip)'),
    range: z.string().optional().describe('CIDR range to filter by (shorthand for scope=Range)'),
    scope: z.string().optional().describe('Scope to filter by (Ip, Range, Username, Session, Country, AS)'),
    value: z.string().optional().describe('Value to filter by (used with scope)'),
    type: z.string().optional().describe('Decision type to filter by (ban, captcha, etc.)'),
    scenario: z.string().optional().describe('Scenario name to filter by'),
    all: z.boolean().optional().default(false).describe('Delete all matching decisions'),
    confirm: z.boolean().optional().default(false).describe('Confirm deletion when all=true')
});

export const decisionTools: ToolDefinition[] = [
    {
        name: 'list_decisions',
        title: 'List Decisions',
        description: 'List active decisions from CrowdSec. Works in both bouncer and watcher modes. Mirrors `cscli decisions list`.',
        inputSchema: ListDecisionsInput,
        kind: 'read',
        annotations: { readOnlyHint: true, idempotentHint: true },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            const { ip, range, scope, value, type, origin, scenario, since, until, contains, no_simulated, all, limit } =
                ListDecisionsInput.parse(input);

            const effectiveLimit = all ? 0 : (limit ?? ctx.config.maxResults);

            if (ctx.mode === 'watcher' && ctx.watcher) {
                const query = {
                    ip,
                    range,
                    scope,
                    value,
                    scenario,
                    decision_type: type,
                    origin,
                    since,
                    until,
                    simulated: no_simulated ? false : undefined,
                    contains,
                    has_active_decision: true,
                    limit: effectiveLimit
                } as APITypes.Alerts.SearchAlerts.RequestQuery & { contains?: boolean };

                const alerts = await ctx.watcher.Alerts.search(query);

                return formatDecisionList(alerts, ctx.config.maxResults);
            }

            if (ctx.mode === 'bouncer' && ctx.bouncer) {
                const decisions = await ctx.bouncer.Decisions.search({
                    ip,
                    range,
                    scope,
                    value,
                    type,
                    origins: origin,
                    scenarios_containing: scenario,
                    contains
                });

                return formatBouncerDecisionList(decisions, ctx.config.maxResults);
            }

            throw new Error('No client available for the current mode');
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
            await ctx.ensureReady();

            if (!ctx.watcher) {
                throw new Error('Watcher client not available');
            }

            const { ip, range, scope: inputScope, value, duration, type, reason, force } = BanIpInput.parse(input);

            // Validate that we have enough to identify the target
            if (!ip && !range && !(inputScope && value)) {
                throw new Error('Must provide ip, range, or scope+value');
            }

            // cscli gives --ip precedence over --range, and both over --scope/--value.
            let scope: string;
            let targetValue: string;

            if (ip) {
                scope = normalizeScope(undefined, ip);
                targetValue = ip;
            } else if (range) {
                scope = normalizeScope(undefined, undefined, range);
                targetValue = range;
            } else {
                scope = normalizeScope(inputScope);
                targetValue = value ?? '';
            }

            if (!targetValue) {
                throw new Error('Value is required for the given scope');
            }

            // Parse and validate duration
            let durationSeconds: number;
            try {
                durationSeconds = parseDuration(duration);
            } catch (e) {
                throw new Error(`Invalid duration: ${(e as Error).message}`);
            }

            // Check allowlist first, like cscli, then enforce the local duration guard.
            if (!force && (scope === 'Ip' || scope === 'Range')) {
                const checkResult = await ctx.allowlists.check(targetValue);
                if (checkResult.allowlisted && checkResult.reason) {
                    throw new Error(
                        `${targetValue} is allowlisted by item ${checkResult.reason}, use force=true to add the decision anyway`
                    );
                }
            }

            // Check max duration unless forced
            if (!force && durationSeconds > ctx.config.maxBanDurationSeconds) {
                const maxDuration = formatDuration(ctx.config.maxBanDurationSeconds);
                throw new Error(`Duration ${duration} exceeds maximum allowed ${maxDuration}. Use force=true to override.`);
            }

            // Build the alert payload exactly as cscli does
            const now = new Date().toISOString();
            const defaultReason = `manual '${type}' from 'crowdsec-mcp'`;
            const alertReason = reason ?? defaultReason;

            const alert = {
                capacity: 0,
                decisions: [
                    {
                        origin: 'cscli',
                        type,
                        scope,
                        value: targetValue,
                        duration,
                        scenario: alertReason
                    }
                ],
                events: [],
                events_count: 1,
                leakspeed: '0',
                message: alertReason,
                scenario: alertReason,
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

            const alertIds = await ctx.watcher.Alerts.pushAlerts([alert]);

            return formatBanResult(alertIds, { scope, value: targetValue, type, duration, reason: alertReason });
        }
    },
    {
        name: 'unban_ip',
        title: 'Unban IP',
        description: 'Delete decisions by ID or filters. Requires watcher mode. Mirrors `cscli decisions delete`.',
        inputSchema: UnbanIpInput,
        kind: 'write',
        requires: ['watcher'],
        annotations: { readOnlyHint: false, destructiveHint: true },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            if (!ctx.watcher) {
                throw new Error('Watcher client not available');
            }

            const { id, ip, range, scope, value, type, scenario, all, confirm } = UnbanIpInput.parse(input);

            if (all) {
                if (!confirm) {
                    throw new Error('Deleting all decisions requires confirm=true');
                }

                if (id !== undefined || ip || range || scope || value || type || scenario) {
                    throw new Error(
                        'Cannot combine all=true with id or filters; use all=true with confirm=true alone to delete everything'
                    );
                }

                const result = await ctx.watcher.Decisions.delete({});
                return formatUnbanResult(result.nbDeleted ?? 0);
            }

            if (id !== undefined) {
                await ctx.watcher.Decisions.deleteById(String(id));
                return formatUnbanResult(1);
            }

            // Require at least one filter
            const hasFilter = ip || range || scope || value || type || scenario;
            if (!hasFilter) {
                throw new Error('Must provide id, at least one filter, or all=true with confirm=true');
            }

            const query = {
                ip,
                range,
                scope,
                value,
                type,
                scenario
            };

            const result = await ctx.watcher.Decisions.delete(query);
            return formatUnbanResult(result.nbDeleted ?? 0);
        }
    }
];
