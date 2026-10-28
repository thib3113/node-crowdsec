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

class BodyTooLargeError extends Error {}
class RequestAbortedError extends Error {}

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
        let settled = false;

        const fail = (error: Error): void => {
            if (settled) {
                return;
            }
            settled = true;
            reject(error);
        };

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
            if (settled) {
                return;
            }
            settled = true;
            if (tooLarge) {
                reject(new BodyTooLargeError('Payload too large'));
                return;
            }
            resolve(Buffer.concat(chunks).toString('utf-8'));
        });

        req.on('error', (error) => fail(error));
        req.on('aborted', () => fail(new RequestAbortedError('Request aborted')));
        req.on('close', () => fail(new RequestAbortedError('Request aborted')));
    });
}

function sendJson(res: http.ServerResponse, status: number, body: string, extraHeaders?: Record<string, string>): void {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        ...extraHeaders
    });
    res.end(body);
}

function sendRpcError(
    res: http.ServerResponse,
    status: number,
    code: number,
    message: string,
    extraHeaders?: Record<string, string>
): void {
    sendJson(
        res,
        status,
        JSON.stringify({
            jsonrpc: '2.0',
            error: { code, message },
            id: null
        }),
        extraHeaders
    );
}

type JsonBodyResult = { ok: true; body: unknown } | { ok: false };

async function readJsonBody(req: http.IncomingMessage, res: http.ServerResponse): Promise<JsonBodyResult> {
    let raw: string;
    try {
        raw = await readBody(req);
    } catch (error) {
        if (error instanceof BodyTooLargeError) {
            sendRpcError(res, 413, -32000, 'Payload too large');
        } else if (error instanceof RequestAbortedError) {
            // The client is gone: there is nothing left to answer.
        } else {
            const message = error instanceof Error ? error.message : String(error);
            process.stderr.write(`crowdsec-mcp: failed to read request body: ${message}\n`);
            sendRpcError(res, 500, -32603, 'Internal server error');
        }
        return { ok: false };
    }

    try {
        return { ok: true, body: JSON.parse(raw) };
    } catch {
        sendRpcError(res, 400, -32700, 'Parse error');
        return { ok: false };
    }
}

function closeResource(promise: Promise<unknown> | undefined, label: string): void {
    if (!promise) {
        return;
    }
    promise.catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`crowdsec-mcp: ${label} failed: ${message}\n`);
    });
}

function sendSetupError(res: http.ServerResponse, error: unknown): void {
    if (error instanceof HttpRequestError) {
        sendRpcError(res, error.status, error.code, error.message);
        return;
    }

    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`crowdsec-mcp: request setup failed: ${message}\n`);
    sendRpcError(res, 500, -32603, 'Internal server error');
}

async function handlePost(req: http.IncomingMessage, res: http.ServerResponse, createRequestServer: RequestServerFactory): Promise<void> {
    const bodyResult = await readJsonBody(req, res);
    if (!bodyResult.ok) {
        return;
    }

    let requestServer: RequestServer;
    try {
        requestServer = await createRequestServer(req.headers);
    } catch (error) {
        sendSetupError(res, error);
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
        closeResource(transport.close(), 'transport close');
        closeResource(server.close(), 'server close');
        if (cleanup) {
            closeResource(cleanup(), 'request cleanup');
        }
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, bodyResult.body);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`crowdsec-mcp: HTTP request failed: ${message}\n`);
        if (!res.headersSent) {
            sendRpcError(res, 500, -32603, 'Internal server error');
        } else {
            res.end();
        }
    }
}

async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    createRequestServer: RequestServerFactory,
    token: string | undefined
): Promise<void> {
    const { method, url } = req;

    // Optional service gate. In passthrough mode the LAPI credential can be
    // the only credential; if a service token is configured, it is required
    // in addition to the per-request LAPI credential.
    if (token && !isAuthorizedHeader(req.headers.authorization, token)) {
        sendRpcError(res, 401, -32001, 'Unauthorized', { 'WWW-Authenticate': 'Bearer' });
        return;
    }

    const pathname = url?.split('?')[0];
    if (pathname !== '/mcp') {
        sendRpcError(res, 404, -32000, 'Not found');
        return;
    }

    if (method === 'POST') {
        await handlePost(req, res, createRequestServer);
        return;
    }

    sendRpcError(res, 405, -32000, 'Method not allowed');
}

export async function startHttpServer(createRequestServer: RequestServerFactory, config: Config): Promise<http.Server> {
    const token = config.http.token;

    const httpServer = http.createServer((req, res) => {
        void handleRequest(req, res, createRequestServer, token).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            process.stderr.write(`crowdsec-mcp: unhandled HTTP request error: ${message}\n`);
            try {
                if (!res.headersSent) {
                    sendRpcError(res, 500, -32603, 'Internal server error');
                } else if (!res.writableEnded) {
                    res.end();
                }
            } catch (sendError) {
                const sendMessage = sendError instanceof Error ? sendError.message : String(sendError);
                process.stderr.write(`crowdsec-mcp: failed to send error response: ${sendMessage}\n`);
                res.destroy();
            }
        });
    });

    httpServer.requestTimeout = 30_000;
    httpServer.headersTimeout = 10_000;
    httpServer.keepAliveTimeout = 5_000;
    httpServer.maxHeadersCount = 100;

    return new Promise<http.Server>((resolve, reject) => {
        httpServer.once('error', reject);

        httpServer.listen(config.http.port, config.http.host, () => {
            httpServer.removeListener('error', reject);
            resolve(httpServer);
        });
    });
}
