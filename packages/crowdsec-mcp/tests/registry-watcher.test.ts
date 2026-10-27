import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, selectTools } from '../src/registry.js';
import { allTools } from '../src/tools/index.js';
import { makeConfig, makeContext } from './helpers.js';

let client: Client | undefined;
let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
    await client?.close();
    await server?.close();
    client = undefined;
    server = undefined;
});

describe('watcher registry', () => {
    it('registers every read and write tool and exposes valid input schemas', async () => {
        const context = makeContext({ config: makeConfig({ readonly: false }) });
        const tools = selectTools(allTools(), context);

        expect(tools.map((tool) => tool.name)).toEqual([
            'crowdsec_status',
            'list_decisions',
            'get_decision',
            'ban_ip',
            'unban_ip',
            'list_alerts',
            'get_alert',
            'list_allowlists',
            'get_allowlist',
            'check_allowlist'
        ]);

        server = createServer(tools, context);
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);

        client = new Client({ name: 'registry-test', version: '0.0.0' });
        await client.connect(clientTransport);

        const listed = await client.listTools();
        expect(listed.tools.map((tool) => tool.name)).toEqual(tools.map((tool) => tool.name));
        expect(listed.tools.find((tool) => tool.name === 'check_allowlist')?.inputSchema).toBeTruthy();

        const byName = new Map(listed.tools.map((tool) => [tool.name, tool]));
        const unbanSchema = byName.get('unban_ip')?.inputSchema as { properties?: Record<string, unknown> };
        const decisionsSchema = byName.get('list_decisions')?.inputSchema as { properties?: Record<string, unknown> };

        expect(unbanSchema?.properties?.id).toBeDefined();
        expect(decisionsSchema?.properties?.no_simulated).toBeDefined();
    });

    it('hides delete_alerts in passthrough without a service token unless forced', () => {
        const base = makeConfig({
            readonly: false,
            enableAlertDelete: true,
            passthrough: true,
            http: { host: '127.0.0.1', port: 0, token: undefined }
        });

        const hidden = selectTools(allTools(), makeContext({ config: base }));
        expect(hidden.map((tool) => tool.name)).not.toContain('delete_alerts');

        const forced = selectTools(
            allTools(),
            makeContext({
                config: { ...base, allowAlertDeleteWithoutToken: true }
            })
        );
        expect(forced.map((tool) => tool.name)).toContain('delete_alerts');

        const withServiceToken = selectTools(
            allTools(),
            makeContext({
                config: { ...base, http: { ...base.http, token: 'service-token' } }
            })
        );
        expect(withServiceToken.map((tool) => tool.name)).toContain('delete_alerts');
    });

    it('exposes delete_alerts only when explicitly enabled', () => {
        const disabled = selectTools(allTools(), makeContext({ config: makeConfig({ readonly: false }) }));
        const enabled = selectTools(allTools(), makeContext({ config: makeConfig({ readonly: false, enableAlertDelete: true }) }));

        expect(disabled.map((tool) => tool.name)).not.toContain('delete_alerts');
        expect(enabled.map((tool) => tool.name)).toContain('delete_alerts');
    });
});
