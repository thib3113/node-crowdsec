import { describe, expect, it } from 'vitest';
import { statusTool } from '../src/tools/system.js';
import { makeConfig, makeContext } from './helpers.js';

describe('crowdsec_status', () => {
    it('renders a human-readable status', async () => {
        const context = makeContext();
        context.activeTools = ['crowdsec_status'];

        const result = await statusTool.handler({}, context);

        expect(result).toContain('CrowdSec MCP is connected.');
        expect(result).toContain('Authentication: watcher (machine)');
        expect(result).toContain('Active tools: crowdsec_status');
    });

    it('marks write as disabled when read-only', async () => {
        const context = makeContext();

        const result = await statusTool.handler({}, context);

        expect(result).toContain('write=yes (disabled by read-only)');
    });

    it('shows write=yes when read-only is disabled', async () => {
        const context = makeContext({ config: makeConfig({ readonly: false }) });

        const result = await statusTool.handler({}, context);

        expect(result).toContain('write=yes,');
    });

    it('shows the declared LAPI version, or that it is not declared', async () => {
        const declared = makeContext({ config: makeConfig({ lapiVersion: '1.8.2' }) });
        expect(await statusTool.handler({}, declared)).toContain('LAPI version: 1.8.2');

        const unknown = makeContext({ config: makeConfig({ lapiVersion: undefined }) });
        expect(await statusTool.handler({}, unknown)).toContain('LAPI version: not declared');
    });

    it('reports a failed connection instead of throwing', async () => {
        const context = makeContext({ ensureReady: () => Promise.reject(new Error('boom')) });

        const result = await statusTool.handler({}, context);

        expect(result).toContain('CrowdSec MCP is connection failed.');
        expect(result).toContain('Readiness: watcher=unknown, bouncer=unknown');
    });
});
