import { describe, expect, it } from 'vitest';
import { statusTool } from '../src/tools/system.js';
import { makeContext } from './helpers.js';

describe('crowdsec_status', () => {
    it('renders a human-readable status', async () => {
        const context = makeContext();
        context.activeTools = ['crowdsec_status'];

        const result = await statusTool.handler({}, context);

        expect(result).toContain('CrowdSec MCP is connected.');
        expect(result).toContain('Authentication: watcher (machine)');
        expect(result).toContain('Active tools: crowdsec_status');
    });
});
