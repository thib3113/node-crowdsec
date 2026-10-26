import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';

const MAX_BODY_SIZE = 4 * 1024 * 1024;

const UNAUTHORIZED_BODY = JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32001, message: 'Unauthorized' },
    id: null
});

const NOT_FOUND_BODY = JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Not found' },
    id: null
});

export function isAuthorizedHeader(header: string | undefined, token: string): boolean {
    if (!header) {
        return false;
    }

    const prefix = 'Bearer ';
    if (!header.startsWith(prefix)) {
        return false;
    }

    const provided = header.slice(prefix.length);
    const expectedBuf = Buffer.from(token);
    const providedBuf = Buffer.from(provided);

    if (expectedBuf.length !== providedBuf.length) {
        return false;
    }

    return timingSafeEqual(expectedBuf, providedBuf);
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let tooLarge = false;

        req.on('data', (chunk: Buffer) => {
            // Once oversized, discard further chunks but keep draining so the socket stays usable for the 413 response.
            if (tooLarge) {
                return;
            }
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                tooLarge = true;
                chunks.length = 0;
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            if (tooLarge) {
                reject(new Error('Payload too large'));
                return;
            }
            resolve(Buffer.concat(chunks).toString('utf-8'));
        });

        req.on('error', reject);
    });
}

function sendJson(res: http.ServerResponse, status: number, body: string, extraHeaders?: Record<string, string>): void {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        ...extraHeaders
    });
    res.end(body);
}

export async function startHttpServer(server: McpServer, config: Config): Promise<http.Server> {
    const token = config.http.token;
    if (!token) {
        throw new Error('HTTP transport requires a bearer token (config.http.token)');
    }

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    await server.connect(transport);

    const httpServer = http.createServer(async (req, res) => {
        const { method, url } = req;

        // Auth first: every request (including unknown routes/methods) requires a valid bearer token.
        if (!isAuthorizedHeader(req.headers.authorization, token)) {
            sendJson(res, 401, UNAUTHORIZED_BODY, { 'WWW-Authenticate': 'Bearer' });
            return;
        }

        const pathname = url?.split('?')[0];
        if (pathname !== '/mcp') {
            sendJson(res, 404, NOT_FOUND_BODY);
            return;
        }

        if (method === 'POST') {
            let raw: string;
            try {
                raw = await readBody(req);
            } catch {
                sendJson(
                    res,
                    413,
                    JSON.stringify({
                        jsonrpc: '2.0',
                        error: { code: -32000, message: 'Payload too large' },
                        id: null
                    })
                );
                return;
            }

            let parsedBody: unknown;
            try {
                parsedBody = JSON.parse(raw);
            } catch {
                sendJson(
                    res,
                    400,
                    JSON.stringify({
                        jsonrpc: '2.0',
                        error: { code: -32700, message: 'Parse error' },
                        id: null
                    })
                );
                return;
            }

            await transport.handleRequest(req, res, parsedBody);
            return;
        }

        if (method === 'GET' || method === 'DELETE') {
            await transport.handleRequest(req, res);
            return;
        }

        res.writeHead(405).end();
    });

    return new Promise<http.Server>((resolve, reject) => {
        httpServer.once('error', reject);

        httpServer.listen(config.http.port, config.http.host, () => {
            httpServer.removeListener('error', reject);
            resolve(httpServer);
        });
    });
}
