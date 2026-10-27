import type { APITypes } from 'crowdsec-client';
import { resolveDecisionExpiry } from '../utils.js';
import { escapeCell, formatDate, formatDecisionExpiry, markdownTable, moreHint, plural, relativeTime, truncateRows } from './common.js';

function formatListHint(hidden: number, maybeMore: boolean, total: number, maxResults: number): string {
    if (hidden > 0) {
        return moreHint(hidden, 'list_alerts');
    }
    if (maybeMore && total >= maxResults) {
        return '\n_More results may be available. Increase `limit` or narrow the filters._';
    }
    return '';
}

function formatDecisionsSummary(decisions: APITypes.Alert['decisions']): string {
    if (!decisions || decisions.length === 0) {
        return '—';
    }

    const counts = new Map<string, { real: number; simulated: number }>();

    for (const d of decisions) {
        if (!resolveDecisionExpiry(d).active) {
            continue;
        }

        const type = d.type ?? 'unknown';
        const isSimulated = d.simulated === true;
        const entry = counts.get(type) ?? { real: 0, simulated: 0 };
        if (isSimulated) {
            entry.simulated += 1;
        } else {
            entry.real += 1;
        }
        counts.set(type, entry);
    }

    const parts: string[] = [];
    for (const [type, entry] of Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        if (entry.real > 0) {
            parts.push(`${type}:${entry.real}`);
        }
        if (entry.simulated > 0) {
            parts.push(`(simul)${type}:${entry.simulated}`);
        }
    }

    return parts.length > 0 ? parts.join(' ') : '—';
}

export function formatAlertList(alerts: APITypes.GetAlertsResponse, maxResults: number, maybeMore = false): string {
    const sortedAlerts = [...alerts].sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) || 0 : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) || 0 : 0;
        return bTime - aTime || (b.id ?? 0) - (a.id ?? 0);
    });
    const { rows: displayRows, hidden } = truncateRows(sortedAlerts, maxResults);

    if (displayRows.length === 0) {
        return '_No alerts found._';
    }

    const headers = ['ID', 'Scope', 'Value', 'Reason', 'Country', 'AS', 'Decisions', 'Created at', 'Kind'];
    const tableRows = displayRows.map((alert) => {
        const source = alert.source;
        const country = source.cn ?? '—';
        const as = source.as_name ? `${source.as_number} (${source.as_name})` : (source.as_number ?? '—');
        const decisionsSummary = formatDecisionsSummary(alert.decisions);
        const createdAt = formatDate(alert.created_at);
        const kind = alert.kind ?? '—';

        return [
            escapeCell(alert.id ?? '—'),
            escapeCell(source.scope),
            escapeCell(source.value),
            escapeCell(alert.message ?? '—'),
            escapeCell(country),
            escapeCell(as),
            escapeCell(decisionsSummary),
            escapeCell(createdAt),
            escapeCell(kind)
        ];
    });

    const summary = plural(displayRows.length, 'alert');
    const hint = formatListHint(hidden, maybeMore, sortedAlerts.length, maxResults);

    return `${summary}:\n\n${markdownTable(headers, tableRows)}${hint}`;
}

function formatDecisionRow(decision: APITypes.Decision): string[] {
    const type = decision.type ?? '—';
    const scope = decision.scope ?? '—';
    const value = decision.value ?? '—';
    const origin = decision.origin ?? '—';
    const duration = decision.duration ?? '—';
    const expiryInfo = resolveDecisionExpiry(decision);
    const until = formatDecisionExpiry(expiryInfo);
    const simulated = decision.simulated === true ? 'yes' : 'no';

    return [
        escapeCell(decision.id ?? '—'),
        escapeCell(type),
        escapeCell(scope),
        escapeCell(value),
        escapeCell(origin),
        escapeCell(duration),
        escapeCell(until),
        escapeCell(simulated)
    ];
}

function formatMeta(meta?: APITypes.Alert['meta']): string {
    if (!meta || meta.length === 0) {
        return '';
    }

    const headers = ['Key', 'Value'];
    const rows = meta.map((m) => {
        let value = m.value ?? '—';
        // Try to parse JSON arrays/objects for readability
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                value = parsed.map(String).join(', ');
            } else if (typeof parsed === 'object' && parsed !== null) {
                value = JSON.stringify(parsed);
            }
        } catch {
            // Not JSON, keep as is
        }
        return [escapeCell(m.key ?? '—'), escapeCell(value)];
    });

    return `\n### Meta\n\n${markdownTable(headers, rows)}`;
}

function eventMetaKeys(meta: unknown): string {
    if (!meta) {
        return '—';
    }
    if (Array.isArray(meta)) {
        const keys = (meta as Array<{ key?: unknown }>).map((m) => (typeof m?.key === 'string' ? m.key : '')).filter(Boolean);
        return keys.length > 0 ? keys.join(', ') : '—';
    }
    if (typeof meta === 'object') {
        const keys = Object.keys(meta as Record<string, unknown>);
        return keys.length > 0 ? keys.join(', ') : '—';
    }
    return '—';
}

function formatEvents(events?: APITypes.Alert['events']): string {
    if (!events || events.length === 0) {
        return '';
    }

    const headers = ['Timestamp', 'Meta Summary'];
    const rows = events.slice(0, 10).map((e) => {
        const timestamp = formatDate(e.timestamp);
        const metaKeys = eventMetaKeys(e.meta as unknown);
        return [escapeCell(timestamp), escapeCell(metaKeys)];
    });

    let result = `\n### Events (${plural(events.length, 'event')})\n\n${markdownTable(headers, rows)}`;
    if (events.length > 10) {
        result += `\n\n_... and ${events.length - 10} more event(s)._`;
    }
    return result;
}

export function formatAlertDetail(alert: APITypes.Alert): string {
    const source = alert.source;
    const country = source.cn ?? '—';
    const as = source.as_name ? `${source.as_number} (${source.as_name})` : (source.as_number ?? '—');

    const lines: string[] = [
        `### Alert #${alert.id ?? '—'}`,
        '',
        `- **Date:** ${formatDate(alert.created_at)} (${relativeTime(alert.created_at)})`,
        `- **Machine:** ${alert.machine_id ?? '—'}`,
        `- **Simulation:** ${alert.simulated ? 'yes' : 'no'}`,
        `- **Remediation:** ${alert.remediation ? 'yes' : 'no'}`,
        `- **Active decisions:** ${(alert.decisions ?? []).filter((d) => resolveDecisionExpiry(d).active).length}`,
        `- **Kind:** ${alert.kind ?? '—'}`,
        `- **Reason:** ${alert.message ?? '—'}`,
        `- **Events count:** ${alert.events_count ?? 0}`,
        `- **Scope:Value:** ${source.scope}:${source.value}`,
        `- **Country:** ${country}`,
        `- **AS:** ${as}`,
        `- **Begin:** ${formatDate(alert.start_at)}`,
        `- **End:** ${formatDate(alert.stop_at)}`,
        `- **UUID:** ${alert.uuid ?? '—'}`
    ];

    // Decisions table: only active decisions are shown. Deleted/expired decisions
    // remain embedded in the alert but are hidden to avoid negative durations.
    const activeDecisions = (alert.decisions ?? []).filter((decision) => resolveDecisionExpiry(decision).active);
    const inactiveCount = (alert.decisions?.length ?? 0) - activeDecisions.length;

    if (activeDecisions.length > 0) {
        const decisionHeaders = ['ID', 'Type', 'Scope', 'Value', 'Origin', 'Remaining', 'Until', 'Simulated'];
        const decisionRows = activeDecisions.map(formatDecisionRow);
        lines.push('', '### Decisions', '', markdownTable(decisionHeaders, decisionRows));
    } else if ((alert.decisions?.length ?? 0) > 0) {
        lines.push('', '### Decisions', '', '_No active decisions._');
    }

    if (inactiveCount > 0) {
        lines.push('', `_${inactiveCount} inactive decision(s) hidden._`);
    }

    // Meta and events
    lines.push(formatMeta(alert.meta), formatEvents(alert.events));

    return lines.join('\n');
}
