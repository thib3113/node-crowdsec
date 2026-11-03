import { describe, expect, it } from 'vitest';
import { createPassthroughContext, resolvePassthroughAuth } from '../src/client.js';
import { HttpRequestError } from '../src/http-error.js';
import { makeConfig } from './helpers.js';

describe('passthrough auth', () => {
    it('requires a LAPI credential', () => {
        expect(() => resolvePassthroughAuth({})).toThrow(HttpRequestError);

        try {
            resolvePassthroughAuth({});
        } catch (error) {
            expect(error).toMatchObject({ status: 401, code: -32001 });
        }
    });

    it('accepts both credential headers on the same request', () => {
        expect(
            resolvePassthroughAuth({
                'x-crowdsec-api-key': 'key',
                'x-crowdsec-token': 'jwt'
            })
        ).toEqual({ apiKey: 'key', token: 'jwt' });
    });

    it('resolves a bouncer API key', () => {
        expect(resolvePassthroughAuth({ 'x-crowdsec-api-key': 'key' })).toEqual({ apiKey: 'key' });
    });

    it('resolves a watcher token', () => {
        expect(resolvePassthroughAuth({ 'x-crowdsec-token': 'jwt' })).toEqual({ token: 'jwt' });
    });
});

describe('createPassthroughContext', () => {
    it('builds a read-only bouncer context', async () => {
        const context = await createPassthroughContext(makeConfig({ passthrough: true }), {
            'x-crowdsec-api-key': 'key'
        });

        try {
            expect(context.mode).toBe('bouncer');
            expect(context.capabilities).toEqual({
                read: true,
                alerts: false,
                decisions: true,
                decisionsFast: true,
                write: false,
                allowlists: false
            });
        } finally {
            await context.stop();
        }
    });

    it('builds a watcher context', async () => {
        const context = await createPassthroughContext(makeConfig({ passthrough: true }), {
            'x-crowdsec-token': 'jwt'
        });

        try {
            expect(context.mode).toBe('watcher');
            expect(context.capabilities).toEqual({
                read: true,
                alerts: true,
                decisions: true,
                decisionsFast: false,
                write: true,
                allowlists: true
            });
        } finally {
            await context.stop();
        }
    });

    it('builds both clients when both headers are present', async () => {
        const context = await createPassthroughContext(makeConfig({ passthrough: true }), {
            'x-crowdsec-api-key': 'key',
            'x-crowdsec-token': 'jwt'
        });

        try {
            expect(context.watcher).toBeDefined();
            expect(context.bouncer).toBeDefined();
            expect(context.capabilities).toEqual({
                read: true,
                alerts: true,
                decisions: true,
                decisionsFast: true,
                write: true,
                allowlists: true
            });
        } finally {
            await context.stop();
        }
    });
});
