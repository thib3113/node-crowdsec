import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import type { AppContext } from './types.js';
import { isValidIp } from './utils.js';

export interface CrowdSecPrompt {
    name: string;
    title: string;
    description: string;
    requires?: Array<'watcher'>;
    register: (server: McpServer, ctx: AppContext) => void;
}

export function isPromptAvailable(prompt: CrowdSecPrompt, ctx: AppContext): boolean {
    return !prompt.requires?.includes('watcher') || ctx.mode === 'watcher';
}

function promptResult(description: string, text: string): GetPromptResult {
    return {
        description,
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text
                }
            }
        ]
    };
}

function writeGuardrail(ctx: AppContext): string {
    if (ctx.mode === 'bouncer') {
        return 'Write tools are unavailable in bouncer mode: report findings and recommendations only.';
    }
    if (ctx.config.readonly) {
        return 'Write tools are disabled (read-only): stop after the analysis and give recommendations.';
    }

    return 'Ask the user for confirmation before calling ban_ip or unban_ip.';
}

const DurationArg = z
    .string()
    .trim()
    .regex(/^\d+[smhd]$/, 'Use a duration with a unit, e.g. 30m, 4h or 7d');

const CountArg = z.string().trim().regex(/^\d+$/, 'Use a positive integer');

const IpArg = z.string().trim().refine(isValidIp, { message: 'Use a valid IPv4 or IPv6 address' });

const CountryArg = z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use an ISO 3166-1 alpha-2 country code, e.g. FR or US')
    .transform((code) => code.toUpperCase());

const TriageAlerts = {
    name: 'triage_alerts',
    title: 'Triage recent CrowdSec alerts',
    description: 'Review recent alerts, correlate them with active decisions, and propose (or apply) remediation.',
    argsSchema: {
        since: DurationArg.optional().describe('Time window to review, e.g. 24h or 7d (default: 24h)'),
        limit: CountArg.optional().describe('Maximum number of alerts to review (default: 25)')
    }
} as const;

type TriageAlertsArgs = z.infer<z.ZodObject<typeof TriageAlerts.argsSchema>>;

const InvestigateIp = {
    name: 'investigate_ip',
    title: 'Investigate an IP in CrowdSec',
    description: 'Summarise the detection history and remediation state of one IP, then recommend an action.',
    argsSchema: {
        ip: IpArg.describe('IPv4 or IPv6 address to investigate')
    }
} as const;

type InvestigateIpArgs = z.infer<z.ZodObject<typeof InvestigateIp.argsSchema>>;

const BannedFromCountry = {
    name: 'banned_from_country',
    title: 'Find banned IPs from a country',
    description: 'List the IPs with an active decision that are geolocated in a given country (MaxMind country code).',
    argsSchema: {
        country: CountryArg.describe('ISO 3166-1 alpha-2 country code, e.g. FR or US'),
        since: DurationArg.optional().describe('How far back to scan alerts (default: 24h)'),
        limit: CountArg.optional().describe('Maximum number of alerts to scan (default: 200)')
    }
} as const;

type BannedFromCountryArgs = z.infer<z.ZodObject<typeof BannedFromCountry.argsSchema>>;

function renderTriageAlerts(args: TriageAlertsArgs, ctx: AppContext): string {
    const since = args.since ?? '24h';
    const limit = args.limit ?? '25';

    return [
        `Triage the CrowdSec alerts from the last ${since} (at most ${limit}).`,
        '',
        `1. Call list_alerts with since="${since}" and limit=${limit}.`,
        '2. Group the alerts by source IP and scenario, and keep the most aggressive sources.',
        '3. For each serious candidate, call get_alert, then list_decisions with the same IP to see what is already blocked.',
        '4. Propose one action per source: ban_ip, leave as is, or allowlist when it looks like a false positive.',
        '5. Explain the evidence (scenario, number of events, time window) for every proposal.',
        '',
        writeGuardrail(ctx),
        'Never invent alert or decision IDs. Read crowdsec://docs/triage for the full workflow.'
    ].join('\n');
}

function renderInvestigateIp(args: InvestigateIpArgs, ctx: AppContext): string {
    const { ip } = args;
    const isBouncer = ctx.mode === 'bouncer';

    let steps: string[];
    let summary: string;
    let recommendation: string;

    if (isBouncer) {
        steps = [
            `1. Call list_decisions with ip="${ip}" to see whether it is currently blocked.`,
            '2. Alerts and allowlists need watcher credentials: state this limitation if it matters.'
        ];
        summary = 'Summarise: active decisions (type, origin and remaining duration).';
        recommendation = 'Then recommend an action for a watcher-capable operator (ban, unban or no action), and justify it.';
    } else {
        steps = [
            `1. Call list_alerts with ip="${ip}" and since="30d" to get the detection history.`,
            `2. Call list_decisions with ip="${ip}" to see whether it is currently blocked.`,
            `3. Call check_allowlist with value="${ip}" to detect an exemption.`,
            '4. If nothing matches, say so explicitly instead of guessing.'
        ];
        summary = 'Summarise: scenarios triggered, event volume, time span, active decisions and allowlist status.';
        recommendation = 'Then recommend ban_ip (with scope, type and duration), unban_ip, or no action, and justify it.';
    }

    return [
        `Investigate the CrowdSec activity for ${ip}.`,
        '',
        ...steps,
        '',
        summary,
        recommendation,
        '',
        writeGuardrail(ctx),
        'Read crowdsec://docs/concepts for scope, type and origin semantics.'
    ].join('\n');
}

function renderBannedFromCountry(args: BannedFromCountryArgs): string {
    const { country } = args;
    const since = args.since ?? '24h';
    const limit = args.limit ?? '200';

    return [
        `List the IPs currently banned by CrowdSec that are geolocated in ${country}.`,
        '',
        `1. Call list_alerts with has_active_decision=true, since="${since}" and limit=${limit}.`,
        `2. Keep only the rows whose Country column is ${country}. That column comes from MaxMind enrichment of the alert source.`,
        '3. For each match, call list_decisions with the matching IP to confirm the decision is still active, and note its type, origin and remaining duration.',
        '4. Report a table: IP, scenario, decision type, origin, remaining duration. If nothing matches, say explicitly that no',
        `   ${country} IP has an active decision in this window, and suggest a wider since value instead of guessing.`,
        '5. Do not ban or unban anything: this is a reporting task.',
        '',
        'Caveats to mention if relevant:',
        '- The LAPI alert search has no country filter, so the selection happens on the Country column: raise limit on a busy window.',
        '- Country comes from GeoIP enrichment; rows without a GeoIP match show a dash and are excluded.',
        `- A decision with scope Country (value ${country}) is not the same thing as an IP geolocated in ${country}.`
    ].join('\n');
}

export const crowdsecPrompts: CrowdSecPrompt[] = [
    {
        name: TriageAlerts.name,
        title: TriageAlerts.title,
        description: TriageAlerts.description,
        requires: ['watcher'],
        register: (server, ctx) => {
            server.registerPrompt(
                TriageAlerts.name,
                {
                    title: TriageAlerts.title,
                    description: TriageAlerts.description,
                    argsSchema: TriageAlerts.argsSchema
                },
                (args) => promptResult(TriageAlerts.description, renderTriageAlerts(args, ctx))
            );
        }
    },
    {
        name: InvestigateIp.name,
        title: InvestigateIp.title,
        description: InvestigateIp.description,
        register: (server, ctx) => {
            server.registerPrompt(
                InvestigateIp.name,
                {
                    title: InvestigateIp.title,
                    description: InvestigateIp.description,
                    argsSchema: InvestigateIp.argsSchema
                },
                (args) => promptResult(InvestigateIp.description, renderInvestigateIp(args, ctx))
            );
        }
    },
    {
        name: BannedFromCountry.name,
        title: BannedFromCountry.title,
        description: BannedFromCountry.description,
        requires: ['watcher'],
        register: (server, ctx) => {
            server.registerPrompt(
                BannedFromCountry.name,
                {
                    title: BannedFromCountry.title,
                    description: BannedFromCountry.description,
                    argsSchema: BannedFromCountry.argsSchema
                },
                (args) => promptResult(BannedFromCountry.description, renderBannedFromCountry(args))
            );
        }
    }
];
