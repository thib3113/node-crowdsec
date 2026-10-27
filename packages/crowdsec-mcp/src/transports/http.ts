import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';
import { HttpRequestError } from '../http-error.js';

export interface RequestServer {
    server: McpServer;
    cleanup?: () => Promise<void>;
}

export type RequestServerFactory = (headers: http.IncomingHttpHeaders) => RequestServer | Promise<RequestServer>;

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

export async function startHttpServer(createRequestServer: RequestServerFactory, config: Config): Promise<http.Server> {
    const token = config.http.token;

    const httpServer = http.createServer(async (req, res) => {
        const { method, url } = req;

        // Optional service gate. In passthrough mode the LAPI credential can be
        // the only credential; if a service token is configured, it is required
        // in addition to the per-request LAPI credential.
        if (token && !isAuthorizedHeader(req.headers.authorization, token)) {
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

            let requestServer: RequestServer;
            try {
                requestServer = await createRequestServer(req.headers);
            } catch (error) {
                if (error instanceof HttpRequestError) {
                    sendJson(
                        res,
                        error.status,
                        JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: error.code, message: error.message },
                            id: null
                        })
                    );
                } else {
                    const message = error instanceof Error ? error.message : String(error);
                    process.stderr.write(`crowdsec-mcp: request setup failed: ${message}\n`);
                    sendJson(
                        res,
                        500,
                        JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: 'Internal server error' },
                            id: null
                        })
                    );
                }
                return;
            }

            // Stateless mode: each request must use a fresh server and transport.
            // Reusing a stateless transport causes message ID collisions and breaks
            // the initialize/notifications sequence used by MCP clients.
            const { server, cleanup } = requestServer;
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true
            });

            res.on('close', () => {
                void transport.close();
                void server.close();
                if (cleanup) {
                    void cleanup();
                }
            });

            try {
                await server.connect(transport);
                await transport.handleRequest(req, res, parsedBody);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                process.stderr.write(`crowdsec-mcp: HTTP request failed: ${message}\n`);
                if (!res.headersSent) {
                    sendJson(
                        res,
                        500,
                        JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: 'Internal server error' },
                            id: null
                        })
                    );
                } else {
                    res.end();
                }
            }
            return;
        }

        if (method === 'GET' || method === 'DELETE') {
            sendJson(
                res,
                405,
                JSON.stringify({
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'Method not allowed' },
                    id: null
                })
            );
            return;
        }

        sendJson(
            res,
            405,
            JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Method not allowed' },
                id: null
            })
        );
    });

    return new Promise<http.Server>((resolve, reject) => {
        httpServer.once('error', reject);

        httpServer.listen(config.http.port, config.http.host, () => {
            httpServer.removeListener('error', reject);
            resolve(httpServer);
        });
    });
}
