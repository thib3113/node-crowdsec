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
});
