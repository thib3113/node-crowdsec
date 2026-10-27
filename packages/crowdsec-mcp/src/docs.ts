import type { AppContext } from './types.js';
import { isAlertDeleteAvailable } from './config.js';

export const DOC_BASE_URL = 'https://docs.crowdsec.net';

export const DOC_LINKS = {
    intro: `${DOC_BASE_URL}/docs/intro/`,
    concepts: `${DOC_BASE_URL}/docs/concepts/`,
    lapi: `${DOC_BASE_URL}/docs/local_api/intro/`,
    bouncers: `${DOC_BASE_URL}/u/bouncers/intro/`,
    scenarios: `${DOC_BASE_URL}/docs/log_processor/scenarios/intro/`,
    communityBlocklist: `${DOC_BASE_URL}/docs/central_api/community_blocklist/`,
    allowlists: `${DOC_BASE_URL}/docs/local_api/centralized_allowlists/`,
    cscliAlerts: `${DOC_BASE_URL}/docs/cscli/cscli_alerts/`,
    cscliDecisions: `${DOC_BASE_URL}/docs/cscli/cscli_decisions/`,
    cscliAllowlists: `${DOC_BASE_URL}/docs/cscli/cscli_allowlists/`
} as const;

export interface DocResource {
    uri: string;
    name: string;
    title: string;
    description: string;
    render: (ctx: AppContext) => string;
}

function authenticationSummary(ctx: AppContext): string {
    if (ctx.mode === 'watcher') {
        const machine = ctx.config.machineId ? ` with machine ${ctx.config.machineId}` : '';
        return `watcher${machine} (machine credentials): alerts, decisions, allowlists and, unless read-only, write tools are available.`;
    }

    return 'bouncer (API key): only active decisions are visible. Alerts, allowlists and write tools are unavailable.';
}

function writeSummary(ctx: AppContext): string {
    if (ctx.mode === 'bouncer') {
        return 'bouncer mode (read-only): no write tools (ban_ip and unban_ip require watcher credentials).';
    }

    return ctx.config.readonly
        ? 'read-only: ban_ip and unban_ip are hidden.'
        : 'read/write: ban_ip and unban_ip are enabled and change real remediation.';
}

function canDeleteAlerts(ctx: AppContext): boolean {
    return isAlertDeleteAvailable(ctx.config);
}

function availabilityLines(ctx: AppContext): string[] {
    return [
        `- Alerts (list_alerts, get_alert): ${ctx.mode === 'watcher' ? 'available' : 'unavailable (watcher credentials required)'}.`,
        `- Allowlists: ${ctx.capabilities.allowlists ? 'available' : 'unavailable in this mode'}.`,
        `- delete_alerts: ${canDeleteAlerts(ctx) ? 'available (destructive, only works on the LAPI host)' : 'hidden'}.`
    ];
}

function workingRules(ctx: AppContext): string[] {
    const rules: string[] = [];
    const add = (rule: string): void => {
        rules.push(`${rules.length + 1}. ${rule}`);
    };

    add('Call crowdsec_status when the connection, mode or active tools are unclear.');

    if (ctx.mode === 'bouncer') {
        add(
            'Only active decisions are visible: list_decisions then get_decision. Say when alerts or allowlists would need watcher credentials.'
        );
        add('A decision origin of CAPI comes from the community blocklist and is not necessarily local to this engine.');
        add('Never invent decision IDs. If a lookup returns nothing, say so instead of guessing.');
        return rules;
    }

    add('Investigate before acting: list_alerts -> get_alert -> list_decisions/get_decision for the same source.');

    if (ctx.config.readonly) {
        add('Write tools are hidden: analyse and recommend, but never claim that a ban or unban was applied.');
    } else {
        add(
            'ban_ip, unban_ip and delete_alerts change real state: summarise the target, type and duration and wait for user confirmation.'
        );
        add('Durations need a unit (30m, 4h, 7d). Durations above the limit require force=true and explicit approval.');
        add('ban_ip refuses allowlisted targets unless force=true; check_allowlist first when in doubt.');
    }

    add('Never invent alert or decision IDs. If a lookup returns nothing, say so instead of guessing.');

    if (canDeleteAlerts(ctx)) {
        add('Deleting an alert also deletes its active decisions (LAPI cascade); do not unban them afterwards.');
    }

    return rules;
}

export function buildInstructions(ctx: AppContext): string {
    const limits =
        ctx.mode === 'watcher' && !ctx.config.readonly
            ? [`Limits: bans longer than ${ctx.config.maxBanDuration} are refused unless force=true.`]
            : [];

    return [
        'CrowdSec MCP exposes alerts, decisions and allowlists from a CrowdSec Local API (LAPI).',
        '',
        'How CrowdSec works: the Log Processor detects behaviour and creates an alert; LAPI profiles turn alerts into',
        'decisions (ban, captcha, ...); remediation components (bouncers) pull decisions and enforce them. Alerts are the',
        'history of what was detected, decisions are the active remediation. An allowlist exempts a source from decisions.',
        '',
        `Authentication: ${authenticationSummary(ctx)}`,
        `Write access: ${writeSummary(ctx)}`,
        ...limits,
        ...availabilityLines(ctx),
        '',
        'Working rules:',
        ...workingRules(ctx),
        '',
        `Documentation: crowdsec://docs/overview, crowdsec://docs/concepts, crowdsec://docs/triage. Upstream: ${DOC_LINKS.concepts}`
    ].join('\n');
}

const OVERVIEW = (ctx: AppContext): string =>
    [
        '# CrowdSec overview',
        '',
        'CrowdSec is an open-source security engine: it detects malicious behaviour in logs and HTTP traffic, stores what',
        'it sees, and lets remediation components block the source.',
        '',
        '## Components',
        '',
        '- Log Processor (LP): acquires logs, parses and enriches events, then matches them against scenarios (and AppSec',
        '  rules for HTTP traffic). A match creates an alert.',
        '- Local API (LAPI): stores alerts and turns them into decisions according to profiles, then serves decisions to',
        '  bouncers. This MCP server talks to the LAPI.',
        '- Remediation Components (bouncers): pull decisions and enforce them (firewall, reverse proxy, web server, ...).',
        '  Some support captcha or throttle in addition to ban.',
        '- Central API (CAPI): shares signals and redistributes curated community decisions (community blocklist).',
        '- Console: hosted web UI for alerts, decisions and blocklists.',
        '',
        '## Lifecycle of one detection',
        '',
        '1. A log line or HTTP request is acquired.',
        '2. Parsers extract fields (source IP, user, status, ...) and enrichers add context (GeoIP, ASN, ...).',
        '3. A scenario correlates events over a time window and triggers an alert.',
        '4. The LAPI stores the alert and applies profiles, creating a decision (for example ban for 4h).',
        '5. A bouncer reads the decision and enforces it until it expires.',
        '',
        '## What this MCP server exposes',
        '',
        '- Alerts: detection history (list_alerts, get_alert).',
        '- Decisions: active remediation (list_decisions, get_decision, ban_ip, unban_ip).',
        '- Allowlists: exemptions that prevent remediation (list_allowlists, get_allowlist, check_allowlist).',
        '- crowdsec_status: connection mode, capabilities and limits.',
        '',
        'Banning manually creates a decision, not just an alert. An alert alone does not block anything.',
        '',
        '## Current server configuration',
        '',
        `- ${authenticationSummary(ctx)}`,
        `- ${writeSummary(ctx)}`,
        ...availabilityLines(ctx),
        '',
        '## Upstream documentation',
        '',
        `- Introduction: ${DOC_LINKS.intro}`,
        `- Concepts: ${DOC_LINKS.concepts}`,
        `- Local API: ${DOC_LINKS.lapi}`,
        `- Remediation components (bouncers): ${DOC_LINKS.bouncers}`,
        `- Scenarios: ${DOC_LINKS.scenarios}`,
        `- Central API and community blocklist: ${DOC_LINKS.communityBlocklist}`
    ].join('\n');

const CONCEPTS = (): string =>
    [
        '# CrowdSec concepts',
        '',
        '## Alert vs decision',
        '',
        'An alert records that a scenario (or AppSec rule) matched. It carries events, a start/stop time and metadata.',
        'A decision is a remediation instruction (type, scope, value, duration) derived from an alert by a profile or',
        'created manually. Bouncers only consume decisions, so creating an alert never blocks traffic by itself.',
        '',
        '## Detection content',
        '',
        '- Parser: extracts fields from a log line.',
        '- Enricher: adds context (GeoIP, ASN, ...).',
        '- Scenario: correlates events over time to detect behaviour (for example many failed logins).',
        '- Collection: bundle of parsers and scenarios installed together from the Hub.',
        '',
        '## Decision attributes',
        '',
        '- scope: Ip, Range, Username, Session, Country or AS. Most deployments only use Ip and Range.',
        '- type: ban in most setups; captcha and throttle exist but are only enforced by bouncers that support them.',
        '- duration: human duration with a unit (30m, 4h, 7d). A decision disappears when it expires.',
        '- origin: cscli (manual), crowdsec (local scenario), CAPI (community blocklist), console, lists. It tells you',
        '  whether a block is local or shared with the CrowdSec network.',
        '- simulated: a decision that is recorded but not enforced. Use no_simulated=true to hide these.',
        '',
        '## Allowlists',
        '',
        'Centralized allowlists exempt IPs and CIDR ranges from decisions. ban_ip refuses an allowlisted target unless',
        'force=true, and check_allowlist reports whether a value matches an entry or a containing range.',
        '',
        '## Authentication: bouncer vs watcher',
        '',
        '- bouncer: API key. Can only read decisions, and only those the bouncer is allowed to see.',
        '- watcher: machine ID and password (or TLS certificates). Full access to alerts and decisions, plus allowlists',
        '  and write operations depending on the server configuration.',
        '',
        '## Upstream documentation',
        '',
        `- Concepts: ${DOC_LINKS.concepts}`,
        `- Local API: ${DOC_LINKS.lapi}`,
        `- Centralized allowlists: ${DOC_LINKS.allowlists}`
    ].join('\n');

function triageModeLines(ctx: AppContext): string[] {
    if (ctx.mode === 'bouncer') {
        return [
            '## Mode caveats',
            '',
            'This server runs in bouncer mode: alerts and allowlists are unavailable, only active decisions can be read.',
            'Work from list_decisions and get_decision, and say when an investigation would need watcher credentials.'
        ];
    }

    const lines = ['## Mode caveats', '', 'This server runs in watcher mode: alerts, decisions and allowlists are available.'];

    if (ctx.config.readonly) {
        lines.push('Write tools are disabled (read-only): analyse and recommend, but do not claim to have banned or unbanned anything.');
    } else {
        lines.push('Write tools are enabled: always get confirmation before ban_ip or unban_ip.');
    }

    return lines;
}

const TRIAGE = (ctx: AppContext): string =>
    [
        '# Alert and decision triage',
        '',
        'Goal: go from an alert to a justified action, with the right scope, type and duration.',
        '',
        '## 1. Look at what fired',
        '',
        'Use list_alerts to see the detection history. Useful filters: since/until, ip or range (CIDR containment),',
        'scenario, origin, kind, has_active_decision and type. Then use get_alert for events and metadata of one alert.',
        '',
        '## 2. Check the current remediation',
        '',
        'Use list_decisions with the same ip/range to see what is already blocked, and get_decision for context.',
        'An already active ban is often enough: avoid stacking duplicate decisions.',
        '',
        '## 3. Decide',
        '',
        '- Confirmed or repeated malicious behaviour: ban_ip on scope Ip, or scope Range when a whole prefix is involved.',
        '- Ambiguous or low volume: prefer captcha when the bouncer supports it, or report without acting.',
        '- False positive: unban_ip, then ask the operator to add the source with `cscli allowlists ...` or the CrowdSec Console; this MCP is read/check only for allowlists.',
        '',
        '## 4. Guardrails',
        '',
        '- Confirm with the user before ban_ip, unban_ip and delete_alerts.',
        '- Durations need a unit. Durations above the configured maximum require force=true and explicit approval.',
        '- ban_ip refuses allowlisted targets unless force=true.',
        '- Deleting an alert also deletes its active decisions (LAPI cascade); do not unban them afterwards.',
        '- delete_alerts is destructive and only works when this server runs on the LAPI host.',
        '',
        ...triageModeLines(ctx),
        '',
        '## cscli equivalents',
        '',
        `- list_alerts ~ cscli alerts list (${DOC_LINKS.cscliAlerts})`,
        `- list_decisions / get_decision ~ cscli decisions list (${DOC_LINKS.cscliDecisions})`,
        `- ban_ip ~ cscli decisions add, unban_ip ~ cscli decisions delete (${DOC_LINKS.cscliDecisions})`,
        `- list_allowlists / check_allowlist ~ cscli allowlists (${DOC_LINKS.cscliAllowlists})`,
        '',
        '## Upstream documentation',
        '',
        `- Concepts: ${DOC_LINKS.concepts}`,
        `- Centralized allowlists: ${DOC_LINKS.allowlists}`,
        `- Remediation components: ${DOC_LINKS.bouncers}`
    ].join('\n');

export const docResources: DocResource[] = [
    {
        uri: 'crowdsec://docs/overview',
        name: 'crowdsec_overview',
        title: 'CrowdSec overview',
        description: 'How CrowdSec works: components, detection lifecycle, and what this MCP server exposes.',
        render: OVERVIEW
    },
    {
        uri: 'crowdsec://docs/concepts',
        name: 'crowdsec_concepts',
        title: 'CrowdSec concepts',
        description: 'Glossary and semantics: alert vs decision, scopes, types, durations, origins, allowlists, bouncer vs watcher.',
        render: CONCEPTS
    },
    {
        uri: 'crowdsec://docs/triage',
        name: 'crowdsec_triage',
        title: 'Alert and decision triage',
        description: 'Recommended workflow to go from an alert to a confirmed ban, unban or allowlist entry, with guardrails.',
        render: TRIAGE
    }
];
