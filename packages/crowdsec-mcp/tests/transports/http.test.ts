import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { isAuthorizedHeader, startHttpServer } from '../../src/transports/http.js';
import type { RequestServerFactory } from '../../src/transports/http.js';
import { HttpRequestError } from '../../src/http-error.js';
import { makeConfig } from '../helpers.js';

const TOKEN = 'test-secret-token';

function makeServerFactory(): RequestServerFactory {
    return () => {
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        server.registerTool('ping', { description: 'Ping' }, async () => ({
            content: [{ type: 'text', text: 'pong' }]
        }));
        return { server };
    };
}

function portOf(server: http.Server): number {
    return (server.address() as AddressInfo).port;
}

function closeServer(server: http.Server): Promise<void> {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}

interface TestResponse {
    status: number;
    headers: http.IncomingHttpHeaders;
    body: string;
}

function request(
    port: number,
    options: { method?: string; path?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<TestResponse> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                host: '127.0.0.1',
                port,
                method: options.method ?? 'GET',
                path: options.path ?? '/mcp',
                headers: options.headers
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') });
                });
                res.on('error', reject);
            }
        );
        req.on('error', reject);
        if (options.body !== undefined) {
            req.write(options.body);
        }
        req.end();
    });
}

function authHeaders(token: string): Record<string, string> {
    return { authorization: `Bearer ${token}` };
}

function initializeBody(): string {
    return JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
        }
    });
}

function httpConfig() {
    return makeConfig({ transport: 'http', http: { host: '127.0.0.1', port: 0, token: TOKEN } });
}

describe('isAuthorizedHeader', () => {
    it('rejects a missing header', () => {
        expect(isAuthorizedHeader(undefined, TOKEN)).toBe(false);
    });

    it('rejects a wrong scheme', () => {
        expect(isAuthorizedHeader(`Basic ${TOKEN}`, TOKEN)).toBe(false);
        expect(isAuthorizedHeader(TOKEN, TOKEN)).toBe(false);
        expect(isAuthorizedHeader('bearer ' + TOKEN, TOKEN)).toBe(false);
    });

    it('rejects a wrong token', () => {
        expect(isAuthorizedHeader('Bearer wrong-token-with-same-length!!', 'wrong-token-with-other-length!')).toBe(false);
        expect(isAuthorizedHeader(authHeaders('wrong').authorization, TOKEN)).toBe(false);
    });

    it('accepts the correct token', () => {
        expect(isAuthorizedHeader(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    });

    it('rejects a length mismatch without throwing', () => {
        expect(isAuthorizedHeader('Bearer short', TOKEN)).toBe(false);
        expect(isAuthorizedHeader(`Bearer ${TOKEN}-with-extra-suffix`, TOKEN)).toBe(false);
    });
});

describe('http transport authentication', () => {
    it('starts without a service token and passes LAPI headers to the factory', async () => {
        let received: http.IncomingHttpHeaders | undefined;
        const factory = makeServerFactory();
        const server = await startHttpServer(
            (headers) => {
                received = headers;
                return factory();
            },
            makeConfig({ http: { host: '127.0.0.1', port: 0, token: undefined } })
        );

        try {
            const res = await request(portOf(server), {
                method: 'POST',
                path: '/mcp',
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json, text/event-stream',
                    'x-crowdsec-api-key': 'lapi-key'
                },
                body: initializeBody()
            });

            expect(res.status).toBe(200);
            expect(received?.['x-crowdsec-api-key']).toBe('lapi-key');
        } finally {
            await closeServer(server);
        }
    });

    it('maps request setup errors to JSON-RPC status codes', async () => {
        const server = await startHttpServer(() => {
            throw new HttpRequestError(401, -32001, 'Missing X-CrowdSec-Api-Key or X-CrowdSec-Token');
        }, httpConfig());

        try {
            const res = await request(portOf(server), {
                method: 'POST',
                path: '/mcp',
                headers: {
                    ...authHeaders(TOKEN),
                    'content-type': 'application/json',
                    accept: 'application/json, text/event-stream'
                },
                body: initializeBody()
            });

            expect(res.status).toBe(401);
            expect(JSON.parse(res.body)).toMatchObject({ error: { code: -32001 } });
        } finally {
            await closeServer(server);
        }
    });

    it('returns 401 without a token, even on unknown routes', async () => {
        const server = await startHttpServer(makeServerFactory(), httpConfig());
        try {
            const port = portOf(server);

            const noAuthMcp = await request(port, { method: 'POST', path: '/mcp', body: '{}' });
            expect(noAuthMcp.status).toBe(401);
            expect(noAuthMcp.headers['www-authenticate']).toBe('Bearer');
            expect(JSON.parse(noAuthMcp.body)).toMatchObject({ jsonrpc: '2.0', error: { code: -32001 } });

            // Auth is checked before routing: unknown route without token is 401, not 404.
            const noAuthOther = await request(port, { method: 'GET', path: '/other' });
            expect(noAuthOther.status).toBe(401);

            // Auth is checked before method handling: unsupported method without token is 401, not 405.
            const noAuthMethod = await request(port, { method: 'PUT', path: '/mcp' });
            expect(noAuthMethod.status).toBe(401);
        } finally {
            await closeServer(server);
        }
    });

    it('returns 401 with a wrong token', async () => {
        const server = await startHttpServer(makeServerFactory(), httpConfig());
        try {
            const port = portOf(server);

            const wrong = await request(port, { method: 'POST', path: '/mcp', headers: authHeaders('wrong-token'), body: '{}' });
            expect(wrong.status).toBe(401);
            expect(wrong.headers['www-authenticate']).toBe('Bearer');

            const wrongScheme = await request(port, { method: 'POST', path: '/mcp', headers: { authorization: 'Basic abc' }, body: '{}' });
            expect(wrongScheme.status).toBe(401);
        } finally {
            await closeServer(server);
        }
    });

    it('accepts a valid token: initialize POST is not 401 and unknown route is 404', async () => {
        const server = await startHttpServer(makeServerFactory(), httpConfig());
        try {
            const port = portOf(server);

            const init = await request(port, {
                method: 'POST',
                path: '/mcp',
                headers: { ...authHeaders(TOKEN), 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
                body: initializeBody()
            });
            expect(init.status).not.toBe(401);
            expect(init.status).toBe(200);

            const other = await request(port, { method: 'GET', path: '/other', headers: authHeaders(TOKEN) });
            expect(other.status).toBe(404);
        } finally {
            await closeServer(server);
        }
    });

    it('returns 405 for unsupported methods after auth', async () => {
        const server = await startHttpServer(makeServerFactory(), httpConfig());
        try {
            const put = await request(portOf(server), { method: 'PUT', path: '/mcp', headers: authHeaders(TOKEN) });
            expect(put.status).toBe(405);
        } finally {
            await closeServer(server);
        }
    });

    it('rejects invalid JSON with 400 after auth', async () => {
        const server = await startHttpServer(makeServerFactory(), httpConfig());
        try {
            const res = await request(portOf(server), {
                method: 'POST',
                path: '/mcp',
                headers: { ...authHeaders(TOKEN), 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
                body: 'not-json{{{'
            });
            expect(res.status).toBe(400);
            expect(JSON.parse(res.body)).toMatchObject({ jsonrpc: '2.0', error: { code: -32700 } });
        } finally {
            await closeServer(server);
        }
    });

    it('supports the SDK client initialize/notifications/tools-list sequence', async () => {
        const server = await startHttpServer(makeServerFactory(), httpConfig());
        try {
            const port = portOf(server);
            const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
                requestInit: {
                    headers: { Authorization: `Bearer ${TOKEN}` }
                }
            });
            const client = new Client({ name: 'sdk-test', version: '1.0.0' });

            await client.connect(transport);
            const tools = await client.listTools();
            expect(Array.isArray(tools.tools)).toBe(true);
            await client.close();
        } finally {
            await closeServer(server);
        }
    });
});
