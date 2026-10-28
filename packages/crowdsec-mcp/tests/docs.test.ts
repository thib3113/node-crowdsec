import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { PromptMessage, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { DOC_LINKS, buildInstructions, docResources } from '../src/docs.js';
import type { DocResource } from '../src/docs.js';
import { createServer, selectTools } from '../src/registry.js';
import { allTools } from '../src/tools/index.js';
import type { AppContext } from '../src/types.js';
import { makeConfig, makeContext } from './helpers.js';

async function connect(ctx: AppContext): Promise<{ client: Client; close: () => Promise<void> }> {
    const server = createServer(selectTools(allTools(), ctx), ctx);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'crowdsec-mcp-docs-test', version: '0.0.0' });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    return {
        client,
        close: async () => {
            await client.close();
            await server.close();
        }
    };
}

function docResource(uri: string): DocResource {
    const resource = docResources.find((entry) => entry.uri === uri);
    if (!resource) {
        throw new Error(`Unknown resource: ${uri}`);
    }
    return resource;
}

function resourceText(contents: ReadResourceResult['contents']): string {
    return contents.map((content) => ('text' in content ? content.text : '')).join('');
}

function promptText(message: PromptMessage | undefined): string {
    const content = message?.content;
    return content && 'text' in content ? content.text : '';
}

const watcherContext = (): AppContext => makeContext();
const bouncerContext = (): AppContext =>
    makeContext({
        mode: 'bouncer',
        capabilities: { read: true, write: false, allowlists: false },
        config: makeConfig({ readonly: true })
    });

describe('server instructions', () => {
    it('describes watcher read/write mode and links upstream docs', () => {
        const instructions = buildInstructions(makeContext({ config: makeConfig({ readonly: false }) }));

        expect(instructions).toContain('watcher');
        expect(instructions).toContain('read/write');
        expect(instructions).toContain(DOC_LINKS.concepts);
        expect(instructions).toContain('crowdsec://docs/triage');
    });

    it('describes bouncer read-only limitations', () => {
        const instructions = buildInstructions(bouncerContext());

        expect(instructions).toContain('bouncer (API key)');
        expect(instructions).toContain('Alerts, allowlists and write tools are unavailable');
        expect(instructions).toContain('read-only');
    });

    it('hides delete_alerts in read-only mode even when it is enabled', () => {
        const instructions = buildInstructions(makeContext({ config: makeConfig({ readonly: true, enableAlertDelete: true }) }));

        expect(instructions).toContain('delete_alerts: hidden');
        expect(instructions).not.toContain('delete_alerts: available');
    });

    it('reports delete_alerts as available in watcher write mode', () => {
        const instructions = buildInstructions(makeContext({ config: makeConfig({ readonly: false, enableAlertDelete: true }) }));

        expect(instructions).toContain('delete_alerts: available');
    });
});

describe('doc resources', () => {
    it('exposes unique, well-formed resources', () => {
        const uris = docResources.map((resource) => resource.uri);

        expect(new Set(uris).size).toBe(uris.length);
        for (const resource of docResources) {
            expect(resource.uri).toMatch(/^crowdsec:\/\/docs\//);
            expect(resource.title.length).toBeGreaterThan(0);
        }
    });

    it('includes upstream links and no unresolved values', () => {
        for (const resource of docResources) {
            const text = resource.render(watcherContext());

            expect(text).toContain(DOC_LINKS.concepts);
            expect(text).not.toContain('undefined');
            expect(text.length).toBeGreaterThan(200);
        }
    });

    it('adapts the triage resource to bouncer mode', () => {
        const text = docResource('crowdsec://docs/triage').render(bouncerContext());

        expect(text).toContain('bouncer mode');
        expect(text).not.toContain('This server runs in watcher mode');
    });
});

describe('prompts', () => {
    it('renders the default triage window', async () => {
        const { client, close } = await connect(watcherContext());

        try {
            const prompt = await client.getPrompt({ name: 'triage_alerts' });
            const text = promptText(prompt.messages[0]);

            expect(text).toContain('last 24h');
            expect(text).toContain('list_alerts');
            expect(text).toContain('ban_ip');
        } finally {
            await close();
        }
    });

    it('respects read-only mode in the IP investigation', async () => {
        const { client, close } = await connect(makeContext({ config: makeConfig({ readonly: true }) }));

        try {
            const prompt = await client.getPrompt({ name: 'investigate_ip', arguments: { ip: '203.0.113.9' } });
            const text = promptText(prompt.messages[0]);

            expect(text).toContain('203.0.113.9');
            expect(text).toContain('check_allowlist');
            expect(text).toContain('read-only');
        } finally {
            await close();
        }
    });

    it('adapts the IP investigation to bouncer mode', async () => {
        const { client, close } = await connect(bouncerContext());

        try {
            const prompt = await client.getPrompt({ name: 'investigate_ip', arguments: { ip: '203.0.113.9' } });
            const text = promptText(prompt.messages[0]);

            expect(text).toContain('watcher credentials');
            expect(text).toContain('list_decisions');
            expect(text).not.toContain('Call list_alerts');
            expect(text).not.toContain('check_allowlist');
        } finally {
            await close();
        }
    });

    it('lists banned IPs from a country and normalises the country code', async () => {
        const { client, close } = await connect(watcherContext());

        try {
            const prompt = await client.getPrompt({ name: 'banned_from_country', arguments: { country: 'fr' } });
            const text = promptText(prompt.messages[0]);

            expect(text).toContain('geolocated in FR');
            expect(text).toContain('Country column');
            expect(text).toContain('list_alerts');
        } finally {
            await close();
        }
    });

    it('rejects an invalid country code', async () => {
        const { client, close } = await connect(watcherContext());

        try {
            await expect(client.getPrompt({ name: 'banned_from_country', arguments: { country: 'FRA' } })).rejects.toThrow();
        } finally {
            await close();
        }
    });

    it('rejects an invalid IP argument', async () => {
        const { client, close } = await connect(watcherContext());

        try {
            await expect(client.getPrompt({ name: 'investigate_ip', arguments: { ip: 'not-an-ip' } })).rejects.toThrow();
        } finally {
            await close();
        }
    });
});

describe('MCP surface', () => {
    it('exposes instructions, resources and prompts to a client', async () => {
        const { client, close } = await connect(watcherContext());

        try {
            expect(client.getInstructions()).toContain('CrowdSec MCP exposes alerts');

            const resources = await client.listResources();
            expect(resources.resources.map((resource) => resource.uri).sort()).toEqual([
                'crowdsec://docs/concepts',
                'crowdsec://docs/overview',
                'crowdsec://docs/triage'
            ]);

            const read = await client.readResource({ uri: 'crowdsec://docs/concepts' });
            expect(read.contents).toHaveLength(1);
            expect(read.contents[0]).toMatchObject({ mimeType: 'text/markdown' });
            expect(resourceText(read.contents)).toContain('alert');

            const prompts = await client.listPrompts();
            expect(prompts.prompts.map((prompt) => prompt.name).sort()).toEqual(['banned_from_country', 'investigate_ip', 'triage_alerts']);

            const prompt = await client.getPrompt({ name: 'investigate_ip', arguments: { ip: '198.51.100.7' } });
            expect(prompt.messages[0]?.role).toBe('user');
            expect(promptText(prompt.messages[0])).toContain('198.51.100.7');

            const tools = await client.listTools();
            expect(tools.tools.map((tool) => tool.name)).toContain('crowdsec_status');
        } finally {
            await close();
        }
    });

    it('keeps the resources available in bouncer mode', async () => {
        const { client, close } = await connect(bouncerContext());

        try {
            const resources = await client.listResources();
            expect(resources.resources).toHaveLength(3);

            const read = await client.readResource({ uri: 'crowdsec://docs/overview' });
            expect(resourceText(read.contents)).toContain('bouncer (API key)');

            const prompts = await client.listPrompts();
            expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(['investigate_ip']);
        } finally {
            await close();
        }
    });
});
