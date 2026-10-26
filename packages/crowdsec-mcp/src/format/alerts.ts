import type { APITypes } from 'crowdsec-client';
import { escapeCell, formatDate, markdownTable, moreHint, plural, relativeTime, truncateRows } from './common.js';

function formatDecisionsSummary(decisions?: APITypes.Alert['decisions']): string {
    if (!decisions || decisions.length === 0) {
        return '—';
    }

    const counts = new Map<string, { real: number; simulated: number }>();

    for (const d of decisions) {
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

export function formatAlertList(alerts: APITypes.GetAlertsResponse, maxResults: number): string {
    const { rows, hidden } = truncateRows(alerts, maxResults);

    if (rows.length === 0) {
        return '_No alerts found._';
    }

    const headers = ['ID', 'Scope', 'Value', 'Reason', 'Country', 'AS', 'Decisions', 'Created at', 'Kind'];
    const tableRows = rows.map((alert) => {
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

    const summary = plural(rows.length, 'alert');
    const hint = moreHint(hidden, 'list_alerts');

    return `${summary}:\n\n${markdownTable(headers, tableRows)}${hint}`;
}

function formatDecisionRow(decision: APITypes.Decision): string[] {
    const type = decision.type ?? '—';
    const scope = decision.scope ?? '—';
    const value = decision.value ?? '—';
    const origin = decision.origin ?? '—';
    const duration = decision.duration ?? '—';
    const until = decision.until ? `${formatDate(decision.until)} (${relativeTime(decision.until)})` : '—';
    const simulated = decision.simulated === true ? 'yes' : 'no';

    return [
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
                value = parsed.map((v) => String(v)).join(', ');
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

    // Decisions table
    if (alert.decisions && alert.decisions.length > 0) {
        const decisionHeaders = ['Type', 'Scope', 'Value', 'Origin', 'Duration', 'Until', 'Simulated'];
        const decisionRows = alert.decisions.map(formatDecisionRow);
        lines.push('', '### Decisions', '', markdownTable(decisionHeaders, decisionRows));
    }

    // Meta
    lines.push(formatMeta(alert.meta));

    // Events
    lines.push(formatEvents(alert.events));

    return lines.join('\n');
}
