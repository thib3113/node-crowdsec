import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const entrypoint = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

let api: http.Server;
let apiUrl: string;
let client: Client;

function cleanEnv(overrides: Record<string, string>): Record<string, string> {
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    return { ...env, ...overrides };
}

describe('stdio end-to-end', () => {
    beforeAll(async () => {
        if (!existsSync(entrypoint)) {
            execFileSync('npm', ['run', 'build'], { cwd: packageRoot, stdio: 'ignore' });
        }

        api = http.createServer((request, response) => {
            if (request.method === 'HEAD' && request.url === '/v1/decisions') {
                response.writeHead(200);
                response.end();
                return;
            }

            if (request.method === 'GET' && request.url?.startsWith('/v1/decisions')) {
                response.setHeader('content-type', 'application/json');
                response.end('[]');
                return;
            }

            response.writeHead(404);
            response.end();
        });

        await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
        const address = api.address();
        if (!address || typeof address === 'string') {
            throw new Error('failed to bind fake CrowdSec API');
        }
        apiUrl = `http://127.0.0.1:${address.port}`;

        const transport = new StdioClientTransport({
            command: process.execPath,
            args: [entrypoint],
            env: cleanEnv({
                CROWDSEC_URL: apiUrl,
                CROWDSEC_API_KEY: 'test-key',
                CROWDSEC_MCP_READONLY: 'true'
            }),
            stderr: 'pipe'
        });

        client = new Client({ name: 'crowdsec-mcp-e2e', version: '0.0.0' });
        await client.connect(transport);
    }, 60000);

    afterAll(async () => {
        await client?.close();
        await new Promise<void>((resolve, reject) => {
            api.close((error) => (error ? reject(error) : resolve()));
        });
    });

    it('lists the read-only tools for a bouncer', async () => {
        const result = await client.listTools();
        const names = result.tools.map((tool) => tool.name);

        expect(names).toContain('crowdsec_status');
        expect(names).toContain('list_decisions');
        expect(names).not.toContain('ban_ip');
        expect(names).not.toContain('list_alerts');
        expect(names).not.toContain('check_allowlist');
    });

    it('calls crowdsec_status over stdio', async () => {
        const result = await client.callTool({ name: 'crowdsec_status', arguments: {} });
        const text = result.content.map((item) => ('text' in item ? item.text : '')).join('\n');

        expect(text).toContain('CrowdSec MCP is connected.');
        expect(text).toContain('Authentication: bouncer');
        expect(text).toContain('Read-only: yes');
    });

    it('calls list_decisions over stdio', async () => {
        const result = await client.callTool({ name: 'list_decisions', arguments: {} });
        const text = result.content.map((item) => ('text' in item ? item.text : '')).join('\n');

        expect(text).toContain('0 decisions total');
    });
});
