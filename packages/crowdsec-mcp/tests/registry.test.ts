import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { selectTools } from '../src/registry.js';
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
    { ...readTool('check_allowlist'), requires: ['watcher', 'allowlists'] as const }
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
        const selected = selectTools(tools, makeContext({ mode: 'bouncer' }));

        expect(selected.map((tool) => tool.name)).not.toContain('check_allowlist');
    });

    it('hides allowlist tools when the capability is unavailable', () => {
        const selected = selectTools(
            tools,
            makeContext({
                capabilities: { read: true, write: true, allowlists: false }
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

    it('rejects unknown tool names', () => {
        expect(() => selectTools(tools, makeContext({ config: makeConfig({ tools: ['does_not_exist'] }) }))).toThrow(/unknown tool/);
    });
});
