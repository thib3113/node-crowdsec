import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cleanErrorMessage, errorResult, selectTools } from '../src/registry.js';
import type { ToolDefinition } from '../src/types.js';
import { makeConfig, makeContext } from './helpers.js';

function readTool(name: string): ToolDefinition {
    return {
        name,
        title: name,
        description: name,
        inputSchema: z.object({}),
        kind: 'read',
        handler: async () => 'ok'
    };
}

function writeTool(name: string): ToolDefinition {
    return {
        ...readTool(name),
        kind: 'write'
    };
}

const tools = [
    readTool('list_decisions'),
    readTool('list_alerts'),
    writeTool('ban_ip'),
    { ...readTool('check_allowlist'), requires: ['allowlists'] as const }
];

describe('registry', () => {
    it('hides write tools in read-only mode', () => {
        const selected = selectTools(tools, makeContext());

        expect(selected.map((tool) => tool.name)).toEqual(['list_decisions', 'list_alerts', 'check_allowlist']);
    });

    it('includes write tools when read-only is disabled', () => {
        const selected = selectTools(tools, makeContext({ config: makeConfig({ readonly: false }) }));

        expect(selected.map((tool) => tool.name)).toContain('ban_ip');
    });

    it('hides watcher-only tools in bouncer mode', () => {
        const selected = selectTools(
            tools,
            makeContext({
                mode: 'bouncer',
                capabilities: { read: true, alerts: false, decisions: true, decisionsFast: true, write: false, allowlists: false }
            })
        );

        expect(selected.map((tool) => tool.name)).not.toContain('check_allowlist');
    });

    it('hides allowlist tools when the capability is unavailable', () => {
        const selected = selectTools(
            tools,
            makeContext({
                capabilities: { read: true, alerts: true, decisions: true, decisionsFast: false, write: true, allowlists: false }
            })
        );

        expect(selected.map((tool) => tool.name)).not.toContain('check_allowlist');
    });

    it('supports an allowlist of tools', () => {
        const selected = selectTools(tools, makeContext({ config: makeConfig({ tools: ['list_alerts'] }) }));

        expect(selected.map((tool) => tool.name)).toEqual(['list_alerts']);
    });

    it('supports a denylist of tools', () => {
        const selected = selectTools(tools, makeContext({ config: makeConfig({ disableTools: ['list_alerts'] }) }));

        expect(selected.map((tool) => tool.name)).toEqual(['list_decisions', 'check_allowlist']);
    });

    it('lets the allowlist override the denylist', () => {
        const selected = selectTools(
            tools,
            makeContext({
                config: makeConfig({ readonly: false, tools: ['ban_ip'], disableTools: ['ban_ip'] })
            })
        );

        expect(selected.map((tool) => tool.name)).toEqual(['ban_ip']);
    });

    it('rejects unknown tool names', () => {
        expect(() => selectTools(tools, makeContext({ config: makeConfig({ tools: ['does_not_exist'] }) }))).toThrow(/unknown tool/);
    });
});

describe('errorResult', () => {
    it('keeps only the first line to avoid leaking stack traces', () => {
        const result = errorResult(new Error('boom\n    at /app/packages/internal.ts:1:1'));

        expect(result.isError).toBe(true);
        expect(result.content[0]).toMatchObject({ type: 'text', text: 'Error: boom' });
    });
});

describe('timeout errors', () => {
    it('turns an axios timeout into an actionable message', () => {
        const error = Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' });
        const result = errorResult(error, { timeout: 10000, toolName: 'list_decisions', hasBouncer: false });

        expect(result.isError).toBe(true);
        const text = (result.content[0] as { text: string }).text;
        expect(text).toContain('timed out after 10000 ms');
        expect(text).toContain('CROWDSEC_TIMEOUT');
        expect(text).toContain('600000');
        expect(text).toContain('bouncer');
    });

    it('does not suggest a bouncer key when one is already configured', () => {
        const result = errorResult(new Error('timeout of 5000ms exceeded'), {
            timeout: 5000,
            toolName: 'list_decisions',
            hasBouncer: true
        });

        expect((result.content[0] as { text: string }).text).not.toContain('Set CROWDSEC_API_KEY');
    });

    it('detects a timeout nested in a client exception', () => {
        const error = new Error('HOST_NOT_REACHABLE');
        (error as Error & { exception?: unknown }).exception = Object.assign(new Error('timeout of 10000ms exceeded'), {
            code: 'ECONNABORTED'
        });

        expect(cleanErrorMessage(error, { timeout: 10000 })).toContain('timed out');
    });
});

describe('cleanErrorMessage', () => {
    it('redacts credentials in URLs and token query parameters', () => {
        const message = cleanErrorMessage(new Error('request to https://user:pass@host/path?token=abc failed'));

        expect(message).not.toContain('pass');
        expect(message).not.toContain('abc');
        expect(message).toContain('***');
        expect(message).toContain('[redacted]');
    });

    it('maps CrowdSec internals to business messages', () => {
        expect(cleanErrorMessage(new Error('CrowdSecError (404) : object not found'))).toBe('Resource not found');
        expect(cleanErrorMessage(new Error("CrowdSecError (500) : allowlist 'nope' not found"))).toBe("Allowlist 'nope' not found");
        expect(cleanErrorMessage(new Error("CrowdSecError (500) : decision with id '999999' doesn't exist: unable to delete"))).toBe(
            'Decision 999999 not found'
        );
        expect(cleanErrorMessage(new Error('CrowdSecError (500) : ent: alert not found'))).toBe('Alert not found');
        expect(cleanErrorMessage(new Error('CrowdSecError (500) : while parsing duration: nope'))).toBe('Invalid duration');
        expect(cleanErrorMessage(new Error('CrowdSecError (403) : access forbidden from this IP (1.2.3.4)'))).toBe(
            'Access forbidden from this IP (alert deletion is only allowed from the LAPI host)'
        );
    });
});
