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
let client: Client;

function cleanEnv(overrides: Record<string, string>): Record<string, string> {
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    return { ...env, ...overrides };
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
    return result.content.map((item) => ('text' in item ? item.text : '')).join('\n');
}

describe('watcher stdio end-to-end', () => {
    beforeAll(async () => {
        if (!existsSync(entrypoint)) {
            execFileSync('npm', ['run', 'build'], { cwd: packageRoot, stdio: 'ignore' });
        }

        api = http.createServer((request, response) => {
            if (request.method === 'POST' && request.url === '/v1/watchers/login') {
                response.setHeader('content-type', 'application/json');
                response.end(
                    JSON.stringify({
                        token: 'test-token',
                        expire: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                    })
                );
                return;
            }

            if (request.headers.authorization !== 'Bearer test-token') {
                response.writeHead(401);
                response.end();
                return;
            }

            if (request.method === 'HEAD' && request.url === '/v1/alerts') {
                response.writeHead(200);
                response.end();
                return;
            }

            if (request.method === 'GET' && request.url?.startsWith('/v1/alerts')) {
                response.setHeader('content-type', 'application/json');
                response.end('[]');
                return;
            }

            if (request.method === 'GET' && request.url?.startsWith('/v1/allowlists/check/')) {
                response.setHeader('content-type', 'application/json');
                response.end(JSON.stringify({ allowlisted: false }));
                return;
            }

            if (request.method === 'GET' && request.url?.startsWith('/v1/allowlists')) {
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

        const transport = new StdioClientTransport({
            command: process.execPath,
            args: [entrypoint],
            env: cleanEnv({
                CROWDSEC_URL: `http://127.0.0.1:${address.port}`,
                CROWDSEC_MACHINE_ID: 'machine',
                CROWDSEC_PASSWORD: 'password',
                CROWDSEC_MCP_READONLY: 'false'
            }),
            stderr: 'pipe'
        });

        client = new Client({ name: 'crowdsec-mcp-watcher-e2e', version: '0.0.0' });
        await client.connect(transport);
    }, 60000);

    afterAll(async () => {
        await client?.close();
        await new Promise<void>((resolve, reject) => {
            api.close((error) => (error ? reject(error) : resolve()));
        });
    });

    it('lists all watcher tools including writes and allowlists', async () => {
        const result = await client.listTools();
        const names = result.tools.map((tool) => tool.name);

        expect(names).toContain('crowdsec_status');
        expect(names).toContain('get_decision');
        expect(names).toContain('list_alerts');
        expect(names).toContain('get_alert');
        expect(names).not.toContain('delete_alerts');
        expect(names).toContain('list_allowlists');
        expect(names).toContain('get_allowlist');
        expect(names).toContain('check_allowlist');
        expect(names).toContain('ban_ip');
        expect(names).toContain('unban_ip');
    });

    it('authenticates as a watcher and sends the bearer token', async () => {
        const result = await client.callTool({ name: 'crowdsec_status', arguments: {} });
        const text = textOf(result);

        expect(text).toContain('Authentication: watcher (machine)');
        expect(text).toContain('Capabilities: read=yes, write=yes, allowlists=yes');
        expect(text).toContain('Read-only: no');
    });

    it('reads alerts through the watcher API', async () => {
        const result = await client.callTool({ name: 'list_alerts', arguments: {} });

        expect(textOf(result)).toContain('_No alerts found._');
    });

    it('reads allowlists through the watcher API', async () => {
        const result = await client.callTool({ name: 'list_allowlists', arguments: {} });

        expect(textOf(result)).toContain('0 allowlists');
    });

    it('checks an allowlist value', async () => {
        const result = await client.callTool({ name: 'check_allowlist', arguments: { value: '203.0.113.10' } });

        expect(textOf(result)).toContain('203.0.113.10: not allowlisted');
    });
});
