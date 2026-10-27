import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const enabled = process.env.CROWDSEC_INTEGRATION === '1';
const url = process.env.CROWDSEC_URL;
const apiKey = process.env.CROWDSEC_API_KEY;
const machineId = process.env.CROWDSEC_MACHINE_ID;
const password = process.env.CROWDSEC_PASSWORD;
const writeEnabled = process.env.CROWDSEC_INTEGRATION_WRITE === '1';

const expectedDecision = process.env.CROWDSEC_INTEGRATION_DECISION ?? '203.0.113.10';
const allowlistName = process.env.CROWDSEC_INTEGRATION_ALLOWLIST ?? 'test-allowlist';
const allowlistIp = process.env.CROWDSEC_INTEGRATION_ALLOWLIST_IP ?? '192.0.2.10';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const entrypoint = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

function cleanEnv(overrides: Record<string, string>): Record<string, string> {
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));

    return {
        ...env,
        CROWDSEC_URL: url!,
        CROWDSEC_MCP_TRANSPORT: 'stdio',
        CROWDSEC_MCP_TOOLS: '',
        CROWDSEC_MCP_DISABLE_TOOLS: '',
        CROWDSEC_TLS_CERT: '',
        CROWDSEC_TLS_KEY: '',
        CROWDSEC_TLS_CA: '',
        ...overrides
    };
}

async function withClient(overrides: Record<string, string>, callback: (client: Client) => Promise<void>): Promise<void> {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [entrypoint],
        env: cleanEnv(overrides),
        stderr: 'pipe'
    });

    const client = new Client({ name: 'crowdsec-mcp-integration', version: '0.0.0' });
    await client.connect(transport);

    try {
        await callback(client);
    } finally {
        await client.close();
    }
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
    return result.content.map((item) => ('text' in item ? item.text : '')).join('\n');
}

function alertIdFor(text: string, value: string): string {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`\\|\\s*(\\d+)\\s*\\|\\s*(?:Ip|Range)\\s*\\|\\s*${escaped}\\s*\\|`));
    if (!match) {
        throw new Error(`could not find alert id for ${value} in:\n${text}`);
    }

    return match[1];
}

describe.skipIf(!enabled || !url)('live CrowdSec LAPI integration', () => {
    it.skipIf(!apiKey)(
        'bouncer reads active decisions',
        async () => {
            await withClient(
                {
                    CROWDSEC_AUTH: 'bouncer',
                    CROWDSEC_API_KEY: apiKey!,
                    CROWDSEC_MCP_READONLY: 'true'
                },
                async (client) => {
                    const tools = await client.listTools();
                    const names = tools.tools.map((tool) => tool.name);

                    expect(names).toContain('crowdsec_status');
                    expect(names).toContain('list_decisions');
                    expect(names).not.toContain('list_alerts');
                    expect(names).not.toContain('ban_ip');

                    const status = textOf(await client.callTool({ name: 'crowdsec_status', arguments: {} }));
                    expect(status).toContain('Authentication: bouncer');

                    const decisions = textOf(await client.callTool({ name: 'list_decisions', arguments: {} }));
                    expect(decisions).toContain(expectedDecision);
                }
            );
        },
        30000
    );

    it.skipIf(!machineId || !password)(
        'watcher reads decisions, alerts and allowlists',
        async () => {
            await withClient(
                {
                    CROWDSEC_AUTH: 'watcher',
                    CROWDSEC_MACHINE_ID: machineId!,
                    CROWDSEC_PASSWORD: password!,
                    CROWDSEC_MCP_READONLY: 'true'
                },
                async (client) => {
                    const tools = await client.listTools();
                    const names = tools.tools.map((tool) => tool.name);

                    expect(names).toContain('list_alerts');
                    expect(names).toContain('list_allowlists');
                    expect(names).toContain('check_allowlist');
                    expect(names).not.toContain('ban_ip');

                    const status = textOf(await client.callTool({ name: 'crowdsec_status', arguments: {} }));
                    expect(status).toContain('Authentication: watcher');

                    const decisions = textOf(await client.callTool({ name: 'list_decisions', arguments: {} }));
                    expect(decisions).toContain(expectedDecision);

                    const alerts = textOf(await client.callTool({ name: 'list_alerts', arguments: {} }));
                    expect(alerts).toContain(expectedDecision);

                    const alertId = alertIdFor(alerts, expectedDecision);
                    const alert = textOf(await client.callTool({ name: 'get_alert', arguments: { id: alertId } }));
                    expect(alert).toContain(expectedDecision);
                    expect(alert).toContain('Decisions');

                    const allowlists = textOf(await client.callTool({ name: 'list_allowlists', arguments: {} }));
                    expect(allowlists).toContain(allowlistName);

                    const allowlist = textOf(await client.callTool({ name: 'get_allowlist', arguments: { name: allowlistName } }));
                    expect(allowlist).toContain(allowlistIp);

                    const check = textOf(await client.callTool({ name: 'check_allowlist', arguments: { value: allowlistIp } }));
                    expect(check).toContain(`${allowlistIp}: allowlisted`);
                }
            );
        },
        30000
    );

    it.skipIf(!writeEnabled || !machineId || !password)(
        'watcher writes: allowlist guard, ban, unban and delete alert',
        async () => {
            const testIp = '198.51.100.10';

            await withClient(
                {
                    CROWDSEC_AUTH: 'watcher',
                    CROWDSEC_MACHINE_ID: machineId!,
                    CROWDSEC_PASSWORD: password!,
                    CROWDSEC_MCP_READONLY: 'false',
                    CROWDSEC_MCP_MAX_BAN_DURATION: '1h'
                },
                async (client) => {
                    const blocked = await client.callTool({ name: 'ban_ip', arguments: { ip: allowlistIp } });
                    expect(blocked.isError).toBe(true);
                    expect(textOf(blocked)).toContain('allowlisted');

                    const ban = textOf(
                        await client.callTool({
                            name: 'ban_ip',
                            arguments: { ip: testIp, duration: '5m', reason: 'mcp integration write' }
                        })
                    );
                    expect(ban).toContain('Decision added successfully');
                    expect(ban).toContain(testIp);

                    try {
                        const decisions = textOf(await client.callTool({ name: 'list_decisions', arguments: {} }));
                        expect(decisions).toContain(testIp);

                        const unban = textOf(await client.callTool({ name: 'unban_ip', arguments: { ip: testIp } }));
                        expect(unban).toMatch(/decision\(s\) deleted/);

                        const afterUnban = textOf(await client.callTool({ name: 'list_decisions', arguments: {} }));
                        expect(afterUnban).not.toContain(testIp);
                    } finally {
                        await client.callTool({ name: 'unban_ip', arguments: { ip: testIp } }).catch(() => undefined);
                    }
                }
            );
        },
        45000
    );
});
