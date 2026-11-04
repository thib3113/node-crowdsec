import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../src/client.js';
import { decisionTools } from '../src/tools/decisions.js';
import { makeConfig } from './helpers.js';

let server: http.Server;
let baseUrl: string;
let watcherValid = true;
let bouncerValid = true;

const decision = {
    id: 123,
    type: 'ban',
    scope: 'ip',
    value: '1.2.3.4',
    origin: 'capi',
    scenario: 'test',
    duration: '4h',
    simulated: false
};

beforeAll(async () => {
    server = http.createServer((request, response) => {
        if (request.method === 'POST' && request.url === '/v1/watchers/login') {
            if (!watcherValid) {
                response.writeHead(403);
                response.end();
                return;
            }
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ token: 'test-token', expire: new Date(Date.now() + 60 * 60 * 1000).toISOString() }));
            return;
        }

        if (request.method === 'HEAD' && request.url === '/v1/alerts') {
            response.writeHead(watcherValid ? 200 : 403);
            response.end();
            return;
        }

        if (request.method === 'HEAD' && request.url === '/v1/decisions') {
            response.writeHead(bouncerValid ? 200 : 403);
            response.end();
            return;
        }

        if (request.method === 'GET' && request.url?.startsWith('/v1/decisions')) {
            if (!bouncerValid) {
                response.writeHead(403);
                response.end();
                return;
            }
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify([decision]));
            return;
        }

        response.writeHead(404);
        response.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

beforeEach(() => {
    watcherValid = true;
    bouncerValid = true;
});

function makeDualConfig() {
    return makeConfig({
        url: baseUrl,
        auth: 'bouncer',
        watcher: true,
        bouncer: true,
        machineId: 'machine',
        password: 'password',
        apiKey: 'key'
    });
}

describe('dual-credential readiness', () => {
    it('does not let an invalid watcher block the bouncer path', async () => {
        watcherValid = false;
        const ctx = await createContext(makeDualConfig());

        try {
            await expect(ctx.ensureReady('bouncer')).resolves.toBeUndefined();
            await expect(ctx.ensureReady('watcher')).rejects.toBeTruthy();
            expect(ctx.readiness.bouncer).toBe('ok');
            expect(ctx.readiness.watcher).toBe('error');

            const tool = decisionTools.find((candidate) => candidate.name === 'list_decisions')!;
            const result = (await tool.handler({}, ctx)) as string;
            expect(result).toContain('1.2.3.4');
        } finally {
            await ctx.stop();
        }
    });

    it('does not let an invalid bouncer block the watcher path', async () => {
        bouncerValid = false;
        const ctx = await createContext(makeDualConfig());

        try {
            await expect(ctx.ensureReady('watcher')).resolves.toBeUndefined();
            await expect(ctx.ensureReady('bouncer')).rejects.toBeTruthy();
            expect(ctx.readiness.watcher).toBe('ok');
            expect(ctx.readiness.bouncer).toBe('error');
        } finally {
            await ctx.stop();
        }
    });

    it('succeeds with any readiness when at least one credential works', async () => {
        bouncerValid = false;
        const ctx = await createContext(makeDualConfig());

        try {
            await expect(ctx.ensureReady('any')).resolves.toBeUndefined();
            expect(ctx.readiness.bouncer).toBe('error');
            expect(ctx.readiness.watcher).toBe('ok');
        } finally {
            await ctx.stop();
        }
    });

    it('maps a static authentication failure to a friendly message', async () => {
        watcherValid = false;
        const ctx = await createContext(makeConfig({ url: baseUrl }));

        try {
            await expect(ctx.ensureReady('watcher')).rejects.toThrow('Invalid CrowdSec token');
        } finally {
            await ctx.stop();
        }
    });

    it('maps a static dual authentication failure to a friendly message', async () => {
        watcherValid = false;
        bouncerValid = false;
        const ctx = await createContext(makeDualConfig());

        try {
            await expect(ctx.ensureReady('any')).rejects.toThrow('Invalid CrowdSec credentials');
        } finally {
            await ctx.stop();
        }
    });

    it('falls back to the bouncer for get_decision and normalises scope/origin', async () => {
        watcherValid = false;
        const ctx = await createContext(makeDualConfig());

        try {
            const tool = decisionTools.find((candidate) => candidate.name === 'get_decision')!;
            const result = (await tool.handler({ id: 123 }, ctx)) as string;

            expect(result).toContain('### Decision #123');
            expect(result).toContain('Scope:** Ip');
            expect(result).toContain('Origin:** CAPI');
        } finally {
            await ctx.stop();
        }
    });
});
