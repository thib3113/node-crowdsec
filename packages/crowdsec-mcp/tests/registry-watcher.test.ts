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
            'ban_ip',
            'unban_ip',
            'list_alerts',
            'get_alert',
            'delete_alerts',
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
    });
});
