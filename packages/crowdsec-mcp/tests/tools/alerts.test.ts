import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alertTools } from '../../src/tools/alerts.js';

function createMockWatcher(alerts: any[], detailAlert?: any) {
    return {
        Alerts: {
            search: vi.fn().mockResolvedValue(alerts),
            getById: vi.fn().mockResolvedValue(detailAlert ?? alerts[0]),
            delete: vi.fn().mockResolvedValue({ nbDeleted: '5' }),
            deleteById: vi.fn().mockResolvedValue({ nbDeleted: '1' })
        }
    };
}

function createMockContext(watcher: any, maxResults = 25) {
    return {
        watcher,
        config: { maxResults, readonly: false, maxBanDuration: '24h', maxBanDurationSeconds: 86400 },
        mode: 'watcher' as const,
        capabilities: { read: true, write: true, allowlists: true },
        ensureReady: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        activeTools: [],
        allowlists: {}
    };
}

describe('alertTools', () => {
    let mockWatcher: ReturnType<typeof createMockWatcher>;
    let mockCtx: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        mockWatcher = createMockWatcher([
            {
                id: 1,
                created_at: '2024-01-15T10:30:00Z',
                machine_id: 'machine-1',
                simulated: false,
                remediation: true,
                kind: 'crowdsec',
                message: 'CrowdSecurity/ssh-bf',
                events_count: 10,
                start_at: '2024-01-15T10:00:00Z',
                stop_at: '2024-01-15T10:30:00Z',
                uuid: 'alert-uuid-1',
                source: {
                    scope: 'Ip',
                    value: '192.168.1.100',
                    cn: 'US',
                    as_number: 'AS12345',
                    as_name: 'Example ISP'
                },
                decisions: [
                    {
                        type: 'ban',
                        scope: 'Ip',
                        value: '192.168.1.100',
                        origin: 'crowdsec',
                        duration: '4h',
                        until: '2024-01-15T14:30:00Z',
                        simulated: false
                    },
                    {
                        type: 'captcha',
                        scope: 'Ip',
                        value: '192.168.1.100',
                        origin: 'crowdsec',
                        duration: '1h',
                        until: '2024-01-15T11:30:00Z',
                        simulated: true
                    }
                ],
                meta: [
                    { key: 'source_ip', value: '192.168.1.100' },
                    { key: 'usernames', value: '["admin","root"]' }
                ],
                events: [
                    { timestamp: '2024-01-15T10:00:00Z', meta: { source_ip: '192.168.1.100', http_path: '/login' } },
                    { timestamp: '2024-01-15T10:05:00Z', meta: { source_ip: '192.168.1.100', http_path: '/login' } }
                ]
            }
        ]);
        mockCtx = createMockContext(mockWatcher, 25);
    });

    describe('list_alerts', () => {
        it('should call search with correct filters', async () => {
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            await tool.handler(
                {
                    ip: '192.168.1.100',
                    scenario: 'crowdsecurity/ssh-bf',
                    type: 'ban',
                    simulated: true,
                    has_active_decision: true,
                    limit: 10
                },
                mockCtx
            );

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '192.168.1.100',
                    scenario: 'crowdsecurity/ssh-bf',
                    decision_type: 'ban',
                    simulated: true,
                    has_active_decision: true,
                    limit: 10
                })
            );
        });

        it('should use config.maxResults as default limit', async () => {
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            await tool.handler({}, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 25
                })
            );
        });

        it('should use limit=0 when all=true', async () => {
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            await tool.handler({ all: true }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 0
                })
            );
        });

        it('should include kind filter in search', async () => {
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            await tool.handler({ kind: 'waf' }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'waf'
                })
            );
        });

        it('should format output as markdown table with summary', async () => {
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            const result = await tool.handler({}, mockCtx);

            expect(result).toContain('1 alert:');
            const headerLine = result.split('\n').find((line) => line.includes('ID') && line.includes('Scope'));
            expect(headerLine).toBeDefined();
            for (const col of ['ID', 'Scope', 'Value', 'Reason', 'Country', 'AS', 'Decisions', 'Created at', 'Kind']) {
                expect(headerLine).toContain(col);
            }
            expect(result).toContain('192.168.1.100');
            expect(result).toContain('ban:1 (simul)captcha:1');
        });

        it('should show moreHint when results exceed maxResults', async () => {
            const manyAlerts = Array.from({ length: 30 }, (_, i) => ({
                id: i + 1,
                created_at: '2024-01-15T10:30:00Z',
                machine_id: 'machine-1',
                simulated: false,
                remediation: true,
                kind: 'crowdsec',
                message: `Scenario ${i}`,
                events_count: 10,
                start_at: '2024-01-15T10:00:00Z',
                stop_at: '2024-01-15T10:30:00Z',
                uuid: `alert-uuid-${i}`,
                source: { scope: 'Ip', value: `192.168.1.${i}`, cn: 'US', as_number: 'AS12345', as_name: 'Example ISP' },
                decisions: []
            }));

            const watcher = createMockWatcher(manyAlerts);
            const ctx = createMockContext(watcher, 25);
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            const result = await tool.handler({}, ctx);

            expect(result).toContain('5 more result(s) hidden');
        });
    });

    describe('get_alert', () => {
        it('should call getById with string ID', async () => {
            const tool = alertTools.find((t) => t.name === 'get_alert')!;
            await tool.handler({ id: '42' }, mockCtx);

            expect(mockWatcher.Alerts.getById).toHaveBeenCalledWith('42');
        });

        it('should call getById with numeric ID converted to string', async () => {
            const tool = alertTools.find((t) => t.name === 'get_alert')!;
            await tool.handler({ id: 42 }, mockCtx);

            expect(mockWatcher.Alerts.getById).toHaveBeenCalledWith('42');
        });

        it('should format alert detail with all sections', async () => {
            const tool = alertTools.find((t) => t.name === 'get_alert')!;
            const result = await tool.handler({ id: '1' }, mockCtx);

            expect(result).toContain('### Alert #1');
            expect(result).toContain('Date:');
            expect(result).toContain('Machine:');
            expect(result).toContain('Simulation:');
            expect(result).toContain('Remediation:');
            expect(result).toContain('Kind:');
            expect(result).toContain('Reason:');
            expect(result).toContain('Events count:');
            expect(result).toContain('Scope:Value:');
            expect(result).toContain('Country:');
            expect(result).toContain('AS:');
            expect(result).toContain('Begin:');
            expect(result).toContain('End:');
            expect(result).toContain('UUID:');

            // Decisions table
            expect(result).toContain('### Decisions');
            const decisionHeader = result.split('\n').find((line) => line.includes('Type') && line.includes('Simulated'));
            expect(decisionHeader).toBeDefined();
            for (const col of ['Type', 'Scope', 'Value', 'Origin', 'Duration', 'Until', 'Simulated']) {
                expect(decisionHeader).toContain(col);
            }
            expect(result).toContain('ban');
            expect(result).toContain('captcha');
            expect(result).toContain('yes');
            expect(result).toContain('no');

            // Meta table
            expect(result).toContain('### Meta');
            expect(result).toContain('source_ip');
            expect(result).toContain('usernames');
            expect(result).toContain('admin');
            expect(result).toContain('root');

            // Events table
            expect(result).toContain('### Events');
            expect(result).toContain('2 event');
            expect(result).toContain('http_path');
        });

        it('should handle alert without decisions', async () => {
            const watcher = createMockWatcher([
                {
                    id: 2,
                    created_at: '2024-01-15T10:30:00Z',
                    machine_id: 'machine-1',
                    simulated: false,
                    remediation: false,
                    kind: 'crowdsec',
                    message: 'Test',
                    events_count: 0,
                    start_at: '2024-01-15T10:00:00Z',
                    stop_at: '2024-01-15T10:30:00Z',
                    uuid: 'alert-uuid-2',
                    source: { scope: 'Ip', value: '10.0.0.1', cn: 'FR', as_number: 'AS999', as_name: 'Test' },
                    decisions: [],
                    meta: [],
                    events: []
                }
            ]);
            const ctx = createMockContext(watcher);
            const tool = alertTools.find((t) => t.name === 'get_alert')!;
            const result = await tool.handler({ id: '2' }, ctx);

            expect(result).toContain('### Alert #2');
            expect(result).not.toContain('### Decisions');
        });

        it('should handle alert without meta', async () => {
            const watcher = createMockWatcher([
                {
                    id: 3,
                    created_at: '2024-01-15T10:30:00Z',
                    machine_id: 'machine-1',
                    simulated: false,
                    remediation: false,
                    kind: 'crowdsec',
                    message: 'Test',
                    events_count: 0,
                    start_at: '2024-01-15T10:00:00Z',
                    stop_at: '2024-01-15T10:30:00Z',
                    uuid: 'alert-uuid-3',
                    source: { scope: 'Ip', value: '10.0.0.1', cn: 'FR', as_number: 'AS999', as_name: 'Test' },
                    decisions: [],
                    meta: undefined,
                    events: []
                }
            ]);
            const ctx = createMockContext(watcher);
            const tool = alertTools.find((t) => t.name === 'get_alert')!;
            const result = await tool.handler({ id: '3' }, ctx);

            expect(result).not.toContain('### Meta');
        });
    });

    describe('delete_alerts', () => {
        it('should delete by ID when id is provided', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            const result = await tool.handler({ id: '42' }, mockCtx);

            expect(mockWatcher.Alerts.deleteById).toHaveBeenCalledWith('42');
            expect(result).toContain('Deleted 1 alert(s).');
        });

        it('should delete by filters when no id provided', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            const result = await tool.handler({ ip: '192.168.1.100', scenario: 'ssh-bf' }, mockCtx);

            expect(mockWatcher.Alerts.delete).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '192.168.1.100',
                    scenario: 'ssh-bf'
                })
            );
            expect(result).toContain('Deleted 5 alert(s).');
        });

        it('should throw when all=true without confirm=true', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;

            await expect(tool.handler({ all: true }, mockCtx)).rejects.toThrow('Deleting all alerts requires confirm=true');
        });

        it('should delete all when all=true and confirm=true', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            const result = await tool.handler({ all: true, confirm: true }, mockCtx);

            expect(mockWatcher.Alerts.delete).toHaveBeenCalledWith({});
            expect(result).toContain('Deleted 5 alert(s).');
        });

        it('should throw when no filters and no id and no all', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;

            await expect(tool.handler({}, mockCtx)).rejects.toThrow(
                'At least one filter (ip, range, scope, value, scenario) or all=true is required'
            );
        });

        it('should throw when only scenario provided without id', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            const result = await tool.handler({ scenario: 'ssh-bf' }, mockCtx);

            expect(mockWatcher.Alerts.delete).toHaveBeenCalledWith(
                expect.objectContaining({
                    scenario: 'ssh-bf'
                })
            );
        });
    });
});
