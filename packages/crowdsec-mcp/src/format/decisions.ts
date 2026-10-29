import type { APITypes } from 'crowdsec-client';
import { normalizeScope, resolveDecisionExpiry } from '../utils.js';
import { escapeCell, expiry, formatDate, formatDecisionExpiry, formatOrigin, markdownTable, plural, truncateRows } from './common.js';

export interface DecisionRow {
    type: string;
    scope: string;
    value: string;
    origin: string;
    scenario: string;
    expires?: string;
    simulated: boolean;
    alertId?: number;
    decisionId?: number;
}

function decisionKey(decision: APITypes.Decision): string {
    return decision.id !== undefined
        ? `id:${decision.id}`
        : `${decision.simulated ?? false}:${decision.type}:${decision.scope}:${decision.value}`;
}

function collectDecisionRows(alerts: APITypes.GetAlertsResponse, now: number): DecisionRow[] {
    const rows: DecisionRow[] = [];
    const seen = new Set<string>();
    const sortedAlerts = [...alerts].sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) || 0 : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) || 0 : 0;
        return bTime - aTime || (b.id ?? 0) - (a.id ?? 0);
    });

    for (const alert of sortedAlerts) {
        for (const decision of alert.decisions ?? []) {
            const expiryInfo = resolveDecisionExpiry(decision, undefined, now);
            if (!expiryInfo.active) {
                continue;
            }

            const key = decisionKey(decision);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);

            rows.push({
                type: decision.type,
                scope: decision.scope,
                value: decision.value,
                origin: decision.origin,
                scenario: decision.scenario,
                expires: expiryInfo.expires,
                simulated: decision.simulated ?? false,
                alertId: alert.id,
                decisionId: decision.id
            });
        }
    }

    return rows;
}

export function formatDecisionList(alerts: APITypes.GetAlertsResponse, maxResults: number, maybeMore = false): string {
    const rows = collectDecisionRows(alerts, Date.now());
    const { rows: displayRows, hidden } = truncateRows(rows, maxResults);

    const table = markdownTable(
        ['Type', 'Scope', 'Value', 'Origin', 'Scenario', 'Expires', 'Simulated', 'Alert ID', 'Decision ID'],
        displayRows.map((r) => [
            escapeCell(r.type),
            escapeCell(r.scope),
            escapeCell(r.value),
            escapeCell(r.origin),
            escapeCell(r.scenario),
            escapeCell(expiry(r.expires)),
            escapeCell(r.simulated ? 'yes' : 'no'),
            escapeCell(r.alertId ?? '-'),
            escapeCell(r.decisionId ?? '-')
        ])
    );

    const summary = `\n${plural(displayRows.length, 'decision')} shown`;
    if (hidden > 0) {
        return table + summary + `\n_${hidden} more result(s) hidden. Increase \`limit\` or narrow the filters._`;
    }
    if (maybeMore && rows.length >= maxResults) {
        return table + summary + `\n_More results may be available. Increase \`limit\` or narrow the filters._`;
    }
    return table + summary;
}

export function formatBouncerDecisionList(decisions: APITypes.GetDecisionsResponse, maxResults: number): string {
    const now = Date.now();
    const sortedDecisions = [...decisions].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const activeDecisions = sortedDecisions.filter((decision) => {
        const endAt = (decision as { endAt?: Date }).endAt;
        if (endAt instanceof Date) {
            return endAt.getTime() > now;
        }
        return resolveDecisionExpiry(decision, undefined, now).active;
    });

    const { rows: displayRows, hidden } = truncateRows(activeDecisions, maxResults);

    const table = markdownTable(
        ['ID', 'Type', 'Scope', 'Value', 'Origin', 'Scenario', 'Expires', 'Simulated'],
        displayRows.map((d) => {
            const endAt = (d as { endAt?: Date }).endAt;
            const expires = d.until ?? (endAt instanceof Date ? endAt.toISOString() : resolveDecisionExpiry(d).expires);
            const scope = d.scope ? normalizeScope(d.scope) : undefined;

            return [
                escapeCell(d.id),
                escapeCell(d.type),
                escapeCell(scope),
                escapeCell(d.value),
                escapeCell(formatOrigin(d.origin)),
                escapeCell(d.scenario),
                escapeCell(expiry(expires)),
                escapeCell(d.simulated ? 'yes' : 'no')
            ];
        })
    );

    const summary = `\n${plural(displayRows.length, 'decision')} shown`;
    return table + summary + (hidden > 0 ? `\n_${hidden} more result(s) hidden. Increase \`limit\` or narrow the filters._` : '');
}

export function formatDecisionDetail(decision: APITypes.Decision, alert?: APITypes.Alert): string {
    const expiryInfo = resolveDecisionExpiry(decision);
    const expires = formatDecisionExpiry(expiryInfo);

    const lines = [
        `### Decision #${decision.id ?? '-'}`,
        '',
        `- **Type:** ${decision.type ?? '-'}`,
        `- **Scope:** ${decision.scope ?? '-'}`,
        `- **Value:** ${decision.value ?? '-'}`,
        `- **Origin:** ${decision.origin ?? '-'}`,
        `- **Scenario:** ${decision.scenario ?? '-'}`,
        `- **Remaining:** ${decision.duration ?? '-'}`,
        `- **Expires:** ${expires}`,
        `- **Simulated:** ${decision.simulated ? 'yes' : 'no'}`
    ];

    if (alert) {
        lines.push(
            '',
            `**Alert #${alert.id ?? '-'}**`,
            `- **Created at:** ${formatDate(alert.created_at)}`,
            `- **Reason:** ${alert.message ?? '-'}`,
            `- **Source:** ${alert.source?.scope ?? '-'}:${alert.source?.value ?? '-'}`
        );
    }

    return lines.join('\n');
}

export function formatBanResult(
    alertIds: string[],
    decision: { scope: string; value: string; type: string; duration: string; reason: string }
): string {
    const lines = [
        `**Decision added successfully**`,
        `**Scope:** ${decision.scope}`,
        `**Value:** ${decision.value}`,
        `**Type:** ${decision.type}`,
        `**Duration:** ${decision.duration}`,
        `**Reason:** ${decision.reason}`,
        `**Alert ID(s):** ${alertIds.join(', ')}`
    ];
    return lines.join('\n');
}

export function formatUnbanResult(nbDeleted: string | number): string {
    const count = Number(nbDeleted);
    if (!Number.isFinite(count) || count === 0) {
        return 'No matching decisions found.';
    }

    return `**${count} decision(s) deleted**`;
}
