import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alertTools } from '../../src/tools/alerts.js';

const CREATED_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const UNTIL = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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
                created_at: CREATED_AT,
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
                        until: UNTIL,
                        simulated: false
                    },
                    {
                        type: 'captcha',
                        scope: 'Ip',
                        value: '192.168.1.100',
                        origin: 'crowdsec',
                        duration: '1h',
                        until: UNTIL,
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
                    has_active_decision: true,
                    limit: 0
                })
            );
        });

        it('should report exact hidden counts for an explicit limit', async () => {
            const manyAlerts = Array.from({ length: 40 }, (_, i) => ({
                id: i + 1,
                created_at: CREATED_AT,
                source: { scope: 'Ip', value: `198.51.100.${i + 1}` },
                decisions: []
            }));
            const watcher = createMockWatcher(manyAlerts);
            const ctx = createMockContext(watcher, 25);
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;

            const limit40 = await tool.handler({ limit: 40 }, ctx);
            expect(limit40).toContain('40 alerts:');
            expect(limit40).not.toContain('more result(s) hidden');

            const limit26 = await tool.handler({ limit: 26 }, ctx);
            expect(limit26).toContain('26 alerts:');
            expect(limit26).toContain('14 more result(s) hidden');

            const limit25 = await tool.handler({ limit: 25 }, ctx);
            expect(limit25).toContain('25 alerts:');
            expect(limit25).toContain('15 more result(s) hidden');

            const limit1000 = await tool.handler({ limit: 1000 }, ctx);
            expect(limit1000).toContain('40 alerts:');
            expect(limit1000).not.toContain('more result(s) hidden');

            expect(watcher.Alerts.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 0 }));
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

        it('should hint that more results may exist when the default limit is reached', async () => {
            const manyAlerts = Array.from({ length: 25 }, (_, i) => ({
                id: i + 1,
                created_at: CREATED_AT,
                source: { scope: 'Ip', value: `198.51.100.${i + 1}` },
                decisions: []
            }));
            const watcher = createMockWatcher(manyAlerts);
            const ctx = createMockContext(watcher, 25);
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;

            const result = await tool.handler({}, ctx);

            expect(result).toContain('25 alerts:');
            expect(result).toContain('More results may be available');
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

        it('should not count expired decisions in the summary', async () => {
            mockWatcher.Alerts.search.mockResolvedValue([
                {
                    id: 99,
                    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    decisions: [
                        {
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            duration: '-20s',
                            simulated: false
                        }
                    ],
                    source: { scope: 'Ip', value: '1.2.3.4' },
                    kind: 'crowdsec'
                }
            ]);

            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            const result = await tool.handler({}, mockCtx);

            expect(result).not.toMatch(/ban:\d/);
        });

        it('should map a missing alert to a business error', async () => {
            mockWatcher.Alerts.getById.mockRejectedValue(new Error('CrowdSecError (404) : object not found'));
            const getAlert = alertTools.find((t) => t.name === 'get_alert')!;

            await expect(getAlert.handler({ id: 999999 }, mockCtx)).rejects.toThrow('Alert 999999 not found');
        });

        it('should reject invalid alert ids and invalid time filters', async () => {
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            const getAlert = alertTools.find((t) => t.name === 'get_alert')!;
            const deleteAlerts = alertTools.find((t) => t.name === 'delete_alerts')!;

            await expect(tool.handler({ since: 'banana' }, mockCtx)).rejects.toThrow(/invalid since/);
            await expect(tool.handler({ since: '10y' }, mockCtx)).rejects.toThrow(/use h, m, s or d/);
            await expect(tool.handler({ since: '2026-01-01T00:00:00Z' }, mockCtx)).rejects.toThrow(/use h, m, s or d/);
            await expect(tool.handler({ scope: 'Country', value: 'ZZ' }, mockCtx)).rejects.toThrow(/invalid country code/);
            await expect(getAlert.handler({ id: 'abc' }, mockCtx)).rejects.toThrow(/alert id must be a positive integer/);
            await expect(deleteAlerts.handler({ all: true, confirm: true, ip: '1.2.3.4' }, mockCtx)).rejects.toThrow(
                /Cannot combine all=true/
            );
        });

        it('should use CIDR containment for list_alerts', async () => {
            mockWatcher.Alerts.search.mockResolvedValue([]);
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;

            await tool.handler({ ip: '198.51.100.0/24' }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '198.51.100.0/24',
                    contains: false
                })
            );
        });

        it('should map a missing alert deletion to a business error', async () => {
            mockWatcher.Alerts.deleteById.mockRejectedValue(new Error('CrowdSecError (500) : ent: alert not found'));
            const deleteAlerts = alertTools.find((t) => t.name === 'delete_alerts')!;

            await expect(deleteAlerts.handler({ id: 999999 }, mockCtx)).rejects.toThrow('Alert 999999 not found');
        });

        it('should show moreHint when results exceed maxResults', async () => {
            const manyAlerts = Array.from({ length: 30 }, (_, i) => ({
                id: i + 1,
                created_at: CREATED_AT,
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

        it('should show all alerts when all=true', async () => {
            const manyAlerts = Array.from({ length: 30 }, (_, i) => ({
                id: i + 1,
                created_at: CREATED_AT,
                source: { scope: 'Ip', value: `192.168.1.${i}` },
                decisions: []
            }));

            const watcher = createMockWatcher(manyAlerts);
            const ctx = createMockContext(watcher, 25);
            const tool = alertTools.find((t) => t.name === 'list_alerts')!;
            const result = await tool.handler({ all: true }, ctx);

            expect(result).toContain('30 alerts:');
            expect(result).not.toContain('more result(s) hidden');
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
            for (const col of ['Type', 'Scope', 'Value', 'Origin', 'Remaining', 'Until', 'Simulated']) {
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
                    created_at: CREATED_AT,
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

        it('should mark expired decisions explicitly', async () => {
            const watcher = createMockWatcher([
                {
                    id: 4,
                    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    machine_id: 'machine-1',
                    simulated: false,
                    remediation: true,
                    kind: 'crowdsec',
                    message: 'Test',
                    events_count: 1,
                    start_at: '2024-01-15T10:00:00Z',
                    stop_at: '2024-01-15T10:30:00Z',
                    uuid: 'alert-uuid-4',
                    source: { scope: 'Ip', value: '1.2.3.4' },
                    decisions: [
                        {
                            id: 1,
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            duration: '-1m25s',
                            simulated: false
                        }
                    ],
                    meta: [],
                    events: []
                }
            ]);
            const ctx = createMockContext(watcher);
            const tool = alertTools.find((t) => t.name === 'get_alert')!;

            const result = await tool.handler({ id: '4' }, ctx);

            expect(result).toContain('_No active decisions._');
            expect(result).toContain('1 inactive decision(s) hidden.');
            expect(result).toContain('Active decisions:** 0');
            expect(result).not.toContain('-1m25s');
        });

        it('should handle alert without meta', async () => {
            const watcher = createMockWatcher([
                {
                    id: 3,
                    created_at: CREATED_AT,
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

        it('should delete all alerts for a scope when scope is provided alone', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            mockWatcher.Alerts.search.mockResolvedValue([
                { id: 1, source: { scope: 'Range', value: '198.51.100.0/24' } },
                { id: 2, source: { scope: 'Ip', value: '198.51.100.1' } }
            ]);
            mockWatcher.Alerts.deleteById.mockResolvedValue({ nbDeleted: '1' });

            const result = await tool.handler({ scope: 'Range' }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith({ scope: 'Range', limit: 0 });
            expect(mockWatcher.Alerts.deleteById).toHaveBeenCalledWith('1');
            expect(result).toContain('Deleted 1 alert(s).');
        });

        it('should delete alerts by origin through a search', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            mockWatcher.Alerts.search.mockResolvedValue([{ id: 11 }, { id: 12 }]);
            mockWatcher.Alerts.deleteById.mockResolvedValue({ nbDeleted: '1' });

            const result = await tool.handler({ origin: 'cscli' }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    origin: 'cscli',
                    limit: 0
                })
            );
            expect(mockWatcher.Alerts.deleteById).toHaveBeenCalledTimes(2);
            expect(mockWatcher.Alerts.delete).not.toHaveBeenCalled();
            expect(result).toContain('Deleted 2 alert(s).');
        });

        it('should delete alerts by decision type and time filters through a search', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            mockWatcher.Alerts.search.mockResolvedValue([{ id: 31 }]);
            mockWatcher.Alerts.deleteById.mockResolvedValue({ nbDeleted: '1' });

            const result = await tool.handler({ type: 'Ban', since: '4h', until: '1h' }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    decision_type: 'ban',
                    since: '4h',
                    until: '1h',
                    limit: 0
                })
            );
            expect(result).toContain('Deleted 1 alert(s).');
        });

        it('should delete alerts with active decisions through a search', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            mockWatcher.Alerts.search.mockResolvedValue([{ id: 21 }]);
            mockWatcher.Alerts.deleteById.mockResolvedValue({ nbDeleted: '1' });

            const result = await tool.handler({ has_active_decision: true }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    has_active_decision: true,
                    limit: 0
                })
            );
            expect(result).toContain('Deleted 1 alert(s).');
        });

        it('should reject unknown parameters', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;

            await expect(tool.handler({ unknown: true }, mockCtx)).rejects.toThrow();
        });

        it('should reject invalid scope values', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;

            await expect(tool.handler({ scope: 'Country', value: 'ZZ' }, mockCtx)).rejects.toThrow(/invalid country code/);
        });

        it('should delete alerts contained in a CIDR', async () => {
            const tool = alertTools.find((t) => t.name === 'delete_alerts')!;
            mockWatcher.Alerts.search.mockResolvedValue([{ id: 101 }, { id: 102 }]);
            mockWatcher.Alerts.deleteById.mockResolvedValue({ nbDeleted: '1' });

            const result = await tool.handler({ range: '198.51.100.0/24' }, mockCtx);

            expect(mockWatcher.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '198.51.100.0/24',
                    contains: false,
                    limit: 0
                })
            );
            expect(mockWatcher.Alerts.deleteById).toHaveBeenCalledTimes(2);
            expect(result).toContain('Deleted 2 alert(s).');
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
                'At least one filter (ip, range, scope, value, scenario, origin, type, since, until, has_active_decision) or all=true is required'
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
