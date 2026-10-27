import type { APITypes } from 'crowdsec-client';
import { isValidCidr } from '../utils.js';
import { escapeCell, markdownTable, formatDate, expiry, truncateRows, moreHint, bullets, plural } from './common.js';

export function formatAllowlistList(allowlists: APITypes.GetAllowlistsResponse, maxResults: number): string {
    const { rows, hidden } = truncateRows(allowlists, maxResults);

    const tableRows = rows.map((al) => [
        escapeCell(al.name),
        escapeCell(al.description),
        escapeCell(formatDate(al.created_at)),
        escapeCell(formatDate(al.updated_at)),
        escapeCell(al.console_managed ? 'yes' : 'no'),
        escapeCell(al.items?.length ?? 0)
    ]);

    const header = 'Name | Description | Created at | Updated at | Managed by Console | Size';
    const table = markdownTable(header.split(' | '), tableRows);

    const summary = `\n${plural(allowlists.length, 'allowlist')}`;
    const hint = moreHint(hidden, 'list_allowlists');

    return `${table}${summary}${hint}`;
}

export function formatAllowlistDetail(allowlist: APITypes.GetAllowlistResponse, withContent: boolean, maxResults: number): string {
    const infoLines = [
        `**${escapeCell(allowlist.name)}**`,
        '',
        bullets([
            `Description: ${escapeCell(allowlist.description ?? '—')}`,
            `Created at: ${formatDate(allowlist.created_at)}`,
            `Updated at: ${formatDate(allowlist.updated_at)}`,
            `Managed by Console: ${allowlist.console_managed ? 'yes' : 'no'}`
        ])
    ];

    if (!withContent) {
        return `${infoLines.join('\n')}\n\n_Content hidden (with_content=false)._`;
    }

    if (!allowlist.items || allowlist.items.length === 0) {
        return `${infoLines.join('\n')}\n\n_No items._`;
    }

    const { rows, hidden } = truncateRows(allowlist.items, maxResults);

    const tableRows = rows.map((item: APITypes.AllowlistItem) => [
        escapeCell(item.value),
        escapeCell(item.description),
        escapeCell(expiry(item.expiration)),
        escapeCell(formatDate(item.created_at))
    ]);

    const header = 'Value | Comment | Expiration | Created at';
    const table = markdownTable(header.split(' | '), tableRows);
    const hint = moreHint(hidden, 'get_allowlist');

    return `${infoLines.join('\n')}\n\n${table}${hint}`;
}

export function formatAllowlistCheck(targets: string[], results: APITypes.BulkCheckAllowlistResult[]): string {
    if (targets.length === 0) {
        return '_No targets provided._';
    }

    const uniqueTargets = [...new Set(targets)];
    const lines: string[] = [];
    let allowlistedCount = 0;

    for (const target of uniqueTargets) {
        const result = results.find((r) => r.target === target);
        const allowlists = result?.allowlists ?? [];
        if (allowlists.length > 0) {
            allowlistedCount++;
            const matchLabel = isValidCidr(target) ? 'CIDR matches allowlist entry/entries' : 'allowlisted by';
            lines.push(`- ${escapeCell(target)}: ${matchLabel} ${escapeCell(allowlists.join(', '))}`);
        } else {
            lines.push(`- ${escapeCell(target)}: not allowlisted`);
        }
    }

    const summary = `${plural(allowlistedCount, 'target')} of ${plural(uniqueTargets.length, 'target')} matched an allowlist.`;
    return `${lines.join('\n')}\n\n${summary}`;
}
