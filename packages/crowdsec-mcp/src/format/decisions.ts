import type { APITypes } from 'crowdsec-client';
import { markdownTable, escapeCell, expiry, plural, truncateRows } from './common.js';

export interface DecisionRow {
    type: string;
    scope: string;
    value: string;
    origin: string;
    scenario: string;
    expires: string;
    simulated: boolean;
    alertId?: number;
}

export function formatDecisionList(alerts: APITypes.GetAlertsResponse, maxResults: number): string {
    const rows: DecisionRow[] = [];
    const seen = new Set<string>();

    for (const alert of alerts) {
        if (!alert.decisions || alert.decisions.length === 0) {
            continue;
        }

        for (const decision of alert.decisions) {
            const key = `${decision.simulated ?? false}:${decision.type}:${decision.scope}:${decision.value}`;
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
                expires: decision.until ?? 'never',
                simulated: decision.simulated ?? false,
                alertId: alert.id
            });
        }
    }

    const { rows: displayRows, hidden } = truncateRows(rows, maxResults);

    const table = markdownTable(
        ['Type', 'Scope', 'Value', 'Origin', 'Scenario', 'Expires', 'Simulated', 'Alert ID'],
        displayRows.map((r) => [
            escapeCell(r.type),
            escapeCell(r.scope),
            escapeCell(r.value),
            escapeCell(r.origin),
            escapeCell(r.scenario),
            escapeCell(expiry(r.expires)),
            escapeCell(r.simulated ? 'yes' : 'no'),
            escapeCell(r.alertId ?? '—')
        ])
    );

    const summary = `\n${plural(rows.length, 'decision')} total`;
    return table + summary + (hidden > 0 ? `\n_${hidden} more result(s) hidden. Increase \`limit\` or narrow the filters._` : '');
}

export function formatBouncerDecisionList(decisions: APITypes.GetDecisionsResponse, maxResults: number): string {
    const { rows: displayRows, hidden } = truncateRows(decisions, maxResults);

    const table = markdownTable(
        ['ID', 'Type', 'Scope', 'Value', 'Origin', 'Scenario', 'Expires', 'Simulated'],
        displayRows.map((d) => [
            escapeCell(d.id),
            escapeCell(d.type),
            escapeCell(d.scope),
            escapeCell(d.value),
            escapeCell(d.origin),
            escapeCell(d.scenario),
            escapeCell(expiry(d.until)),
            escapeCell(d.simulated ? 'yes' : 'no')
        ])
    );

    const summary = `\n${plural(decisions.length, 'decision')} total`;
    return table + summary + (hidden > 0 ? `\n_${hidden} more result(s) hidden. Increase \`limit\` or narrow the filters._` : '');
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
    return `**${nbDeleted} decision(s) deleted**`;
}
