import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decisionTools } from '../../src/tools/decisions.js';

describe('decisionTools', () => {
    const createMockWatcher = () => ({
        Alerts: {
            search: vi.fn(),
            pushAlerts: vi.fn()
        },
        Decisions: {
            deleteById: vi.fn(),
            delete: vi.fn()
        }
    });

    const createMockBouncer = () => ({
        Decisions: {
            search: vi.fn()
        }
    });

    const createMockAllowlists = () => ({
        check: vi.fn()
    });

    const createMockConfig = (overrides = {}) => ({
        maxResults: 100,
        maxBanDurationSeconds: 86400, // 24h
        ...overrides
    });

    const createMockContext = (overrides = {}) => ({
        mode: 'watcher' as const,
        capabilities: { read: true, write: true, allowlists: true },
        watcher: createMockWatcher(),
        bouncer: undefined,
        allowlists: createMockAllowlists(),
        config: createMockConfig(),
        ensureReady: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        ...overrides
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const findTool = (name: string) => decisionTools.find((t) => t.name === name);

    describe('list_decisions', () => {
        it('should call watcher Alerts.search in watcher mode', async () => {
            const mockAlerts = [
                {
                    id: 1,
                    decisions: [
                        {
                            id: 1,
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            scenario: 'manual ban',
                            duration: '4h',
                            until: '2025-01-01T00:00:00Z',
                            simulated: false
                        }
                    ]
                }
            ];

            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue(mockAlerts);

            const tool = findTool('list_decisions');
            const result = await tool!.handler({ limit: 10 }, ctx as any);

            expect(ctx.watcher!.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 10,
                    has_active_decision: true
                })
            );
            expect(result).toContain('ban');
            expect(result).toContain('1.2.3.4');
        });

        it('should call bouncer Decisions.search in bouncer mode', async () => {
            const mockDecisions = [
                {
                    id: 1,
                    type: 'ban',
                    scope: 'Ip',
                    value: '1.2.3.4',
                    origin: 'cscli',
                    scenario: 'manual ban',
                    duration: '4h',
                    until: '2025-01-01T00:00:00Z',
                    simulated: false
                }
            ];

            const ctx = createMockContext({
                mode: 'bouncer',
                watcher: undefined,
                bouncer: createMockBouncer()
            });
            ctx.bouncer!.Decisions.search.mockResolvedValue(mockDecisions);

            const tool = findTool('list_decisions');
            const result = await tool!.handler({ limit: 10 }, ctx as any);

            expect(ctx.bouncer!.Decisions.search).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    limit: expect.anything()
                })
            );
            expect(result).toContain('ban');
            expect(result).toContain('1.2.3.4');
        });

        it('should deduplicate decisions by simulated:type:scope:value', async () => {
            const mockAlerts = [
                {
                    id: 1,
                    decisions: [
                        {
                            id: 1,
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            scenario: 'test',
                            duration: '4h',
                            until: '2025-01-01T00:00:00Z',
                            simulated: false
                        },
                        {
                            id: 2,
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            scenario: 'test',
                            duration: '4h',
                            until: '2025-01-01T00:00:00Z',
                            simulated: false
                        }
                    ]
                },
                {
                    id: 2,
                    decisions: [
                        {
                            id: 3,
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            scenario: 'test',
                            duration: '4h',
                            until: '2025-01-01T00:00:00Z',
                            simulated: false
                        }
                    ]
                }
            ];

            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue(mockAlerts);

            const tool = findTool('list_decisions');
            const result = await tool!.handler({}, ctx as any);

            // Should only show 1 decision due to deduplication
            expect(result).toContain('1 decision total');
            expect(result.match(/1\.2\.3\.4/g)?.length).toBe(1);
        });

        it('should respect maxResults limit and show more hint', async () => {
            const mockAlerts = Array.from({ length: 150 }, (_, i) => ({
                id: i + 1,
                decisions: [
                    {
                        id: i + 1,
                        type: 'ban',
                        scope: 'Ip',
                        value: `1.2.3.${i}`,
                        origin: 'cscli',
                        scenario: 'test',
                        duration: '4h',
                        until: '2025-01-01T00:00:00Z',
                        simulated: false
                    }
                ]
            }));

            const ctx = createMockContext({ config: createMockConfig({ maxResults: 100 }) });
            ctx.watcher!.Alerts.search.mockResolvedValue(mockAlerts);

            const tool = findTool('list_decisions');
            const result = await tool!.handler({ all: true }, ctx as any);

            expect(result).toContain('50 more result(s) hidden');
        });

        it('should pass through all filter parameters', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([]);

            const tool = findTool('list_decisions');
            await tool!.handler(
                {
                    ip: '1.2.3.4',
                    range: '192.168.1.0/24',
                    scope: 'Ip',
                    value: '1.2.3.4',
                    type: 'ban',
                    origin: 'cscli',
                    scenario: 'test',
                    since: '24h',
                    until: '1h',
                    contains: true,
                    no_simulated: true
                },
                ctx as any
            );

            expect(ctx.watcher!.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '1.2.3.4',
                    range: '192.168.1.0/24',
                    scope: 'Ip',
                    value: '1.2.3.4',
                    scenario: 'test',
                    decision_type: 'ban',
                    origin: 'cscli',
                    since: '24h',
                    until: '1h',
                    contains: true,
                    simulated: false,
                    has_active_decision: true
                })
            );
        });
    });

    describe('ban_ip', () => {
        it('should reject when no target identifier provided', async () => {
            const ctx = createMockContext();
            const tool = findTool('ban_ip');

            await expect(tool!.handler({}, ctx as any)).rejects.toThrow('Must provide ip, range, or scope+value');
        });

        it('should use ip as scope Ip when provided', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });

            const tool = findTool('ban_ip');
            const result = await tool!.handler({ ip: '1.2.3.4' }, ctx as any);

            expect(result).toContain('1.2.3.4');
            expect(result).toContain('Ip');
            expect(ctx.watcher!.Alerts.pushAlerts).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        decisions: expect.arrayContaining([
                            expect.objectContaining({
                                scope: 'Ip',
                                value: '1.2.3.4',
                                type: 'ban',
                                duration: '4h'
                            })
                        ])
                    })
                ])
            );
        });

        it('should use range as scope Range when provided', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });

            const tool = findTool('ban_ip');
            const result = await tool!.handler({ range: '192.168.1.0/24' }, ctx as any);

            expect(result).toContain('192.168.1.0/24');
            expect(result).toContain('Range');
            expect(ctx.watcher!.Alerts.pushAlerts).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        decisions: expect.arrayContaining([
                            expect.objectContaining({
                                scope: 'Range',
                                value: '192.168.1.0/24'
                            })
                        ])
                    })
                ])
            );
        });

        it('should give ip precedence over range and value like cscli', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });

            const tool = findTool('ban_ip');
            await tool!.handler({ ip: '1.2.3.4', range: '10.0.0.0/8', value: '5.6.7.8', scope: 'Range' }, ctx as any);

            expect(ctx.allowlists.check).toHaveBeenCalledWith('1.2.3.4');
            expect(ctx.watcher!.Alerts.pushAlerts).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        decisions: expect.arrayContaining([
                            expect.objectContaining({
                                scope: 'Ip',
                                value: '1.2.3.4'
                            })
                        ])
                    })
                ])
            );
        });

        it('should reject invalid IP', async () => {
            const ctx = createMockContext();
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ ip: 'not-an-ip' }, ctx as any)).rejects.toThrow('not-an-ip is not a valid ip');
        });

        it('should reject invalid CIDR', async () => {
            const ctx = createMockContext();
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ range: 'not-a-cidr' }, ctx as any)).rejects.toThrow('not-a-cidr is not a valid range');
        });

        it('should check allowlist for Ip scope', async () => {
            const ctx = createMockContext();
            ctx.allowlists.check.mockResolvedValue({ allowlisted: true, reason: 'admin-allowlist' });
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ ip: '1.2.3.4' }, ctx as any)).rejects.toThrow(
                '1.2.3.4 is allowlisted by item admin-allowlist, use force=true to add the decision anyway'
            );
            expect(ctx.allowlists.check).toHaveBeenCalledWith('1.2.3.4');
        });

        it('should check allowlist for Range scope', async () => {
            const ctx = createMockContext();
            ctx.allowlists.check.mockResolvedValue({ allowlisted: true, reason: 'net-allowlist' });
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ range: '192.168.1.0/24' }, ctx as any)).rejects.toThrow(
                '192.168.1.0/24 is allowlisted by item net-allowlist, use force=true to add the decision anyway'
            );
            expect(ctx.allowlists.check).toHaveBeenCalledWith('192.168.1.0/24');
        });

        it('should bypass allowlist check with force=true', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: true, reason: 'admin-allowlist' });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4', force: true }, ctx as any);

            expect(result).toContain('1.2.3.4');
            expect(ctx.allowlists.check).not.toHaveBeenCalled();
        });

        it('should skip allowlist check for non-Ip/Range scopes', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: true, reason: 'admin-allowlist' });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ scope: 'Username', value: 'admin' }, ctx as any);

            expect(result).toContain('admin');
            expect(ctx.allowlists.check).not.toHaveBeenCalled();
        });

        it('should build a cscli-compatible alert payload', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            await tool!.handler({ ip: '1.2.3.4', duration: '4h', type: 'ban', reason: 'test reason' }, ctx as any);

            expect(ctx.watcher!.Alerts.pushAlerts).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        decisions: [
                            expect.objectContaining({
                                origin: 'cscli',
                                type: 'ban',
                                scope: 'Ip',
                                value: '1.2.3.4',
                                duration: '4h',
                                scenario: 'test reason'
                            })
                        ],
                        events: [],
                        events_count: 1,
                        leakspeed: '0',
                        message: 'test reason',
                        scenario: 'test reason',
                        scenario_hash: '',
                        scenario_version: '',
                        simulated: false,
                        source: expect.objectContaining({
                            scope: 'Ip',
                            value: '1.2.3.4',
                            ip: '1.2.3.4',
                            range: ''
                        }),
                        remediation: true,
                        kind: 'cscli'
                    })
                ])
            );
        });

        it('should reject duration exceeding maxBanDurationSeconds', async () => {
            const ctx = createMockContext({ config: createMockConfig({ maxBanDurationSeconds: 3600 }) }); // 1h
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ ip: '1.2.3.4', duration: '2h' }, ctx as any)).rejects.toThrow('exceeds maximum allowed 1h');
        });

        it('should report the allowlist before the max duration guard', async () => {
            const ctx = createMockContext({ config: createMockConfig({ maxBanDurationSeconds: 3600 }) });
            ctx.allowlists.check.mockResolvedValue({ allowlisted: true, reason: 'admin-allowlist' });
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ ip: '1.2.3.4', duration: '2h' }, ctx as any)).rejects.toThrow('allowlisted');
        });

        it('should allow duration exceeding max with force=true', async () => {
            const ctx = createMockContext({ config: createMockConfig({ maxBanDurationSeconds: 3600 }) });
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4', duration: '2h', force: true }, ctx as any);

            expect(result).toContain('2h');
        });

        it('should use default duration 4h when not provided', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4' }, ctx as any);

            expect(result).toContain('4h');
        });

        it('should use default type ban when not provided', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4' }, ctx as any);

            expect(result).toContain('ban');
        });

        it('should use default reason when not provided', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4' }, ctx as any);

            expect(result).toContain("manual 'ban' from 'crowdsec-mcp'");
        });

        it('should pass custom reason to alert', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4', reason: 'custom reason' }, ctx as any);

            expect(result).toContain('custom reason');
            expect(ctx.watcher!.Alerts.pushAlerts).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        decisions: expect.arrayContaining([
                            expect.objectContaining({
                                scenario: 'custom reason'
                            })
                        ]),
                        message: 'custom reason',
                        scenario: 'custom reason'
                    })
                ])
            );
        });

        it('should include alert ID in result', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-123', 'alert-456']);
            ctx.allowlists.check.mockResolvedValue({ allowlisted: false });
            const tool = findTool('ban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4' }, ctx as any);

            expect(result).toContain('alert-123');
            expect(result).toContain('alert-456');
        });
    });

    describe('unban_ip', () => {
        it('should reject all=true without confirm=true', async () => {
            const ctx = createMockContext();
            const tool = findTool('unban_ip');

            await expect(tool!.handler({ all: true }, ctx as any)).rejects.toThrow('Deleting all decisions requires confirm=true');
        });

        it('should delete all decisions when all=true and confirm=true', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Decisions.delete.mockResolvedValue({ nbDeleted: '5' });
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ all: true, confirm: true }, ctx as any);

            expect(result).toContain('5 decision(s) deleted');
            expect(ctx.watcher!.Decisions.delete).toHaveBeenCalledWith({});
        });

        it('should reject all=true combined with filters', async () => {
            const ctx = createMockContext();
            const tool = findTool('unban_ip');

            await expect(tool!.handler({ all: true, confirm: true, ip: '1.2.3.4' }, ctx as any)).rejects.toThrow(
                'Cannot combine all=true with id or filters'
            );
        });

        it('should delete by id when provided', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Decisions.deleteById.mockResolvedValue({});
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ id: '123' }, ctx as any);

            expect(result).toContain('1 decision(s) deleted');
            expect(ctx.watcher!.Decisions.deleteById).toHaveBeenCalledWith('123');
        });

        it('should delete by filters when provided', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Decisions.delete.mockResolvedValue({ nbDeleted: '3' });
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ ip: '1.2.3.4', type: 'ban' }, ctx as any);

            expect(result).toContain('3 decision(s) deleted');
            expect(ctx.watcher!.Decisions.delete).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '1.2.3.4',
                    type: 'ban'
                })
            );
        });

        it('should reject when no id, no filters, and not all', async () => {
            const ctx = createMockContext();
            const tool = findTool('unban_ip');

            await expect(tool!.handler({}, ctx as any)).rejects.toThrow(
                'Must provide id, at least one filter, or all=true with confirm=true'
            );
        });

        it('should pass all filter types to delete', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Decisions.delete.mockResolvedValue({ nbDeleted: '1' });
            const tool = findTool('unban_ip');

            await tool!.handler(
                {
                    ip: '1.2.3.4',
                    range: '192.168.1.0/24',
                    scope: 'Ip',
                    value: '1.2.3.4',
                    type: 'ban',
                    scenario: 'test'
                },
                ctx as any
            );

            expect(ctx.watcher!.Decisions.delete).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '1.2.3.4',
                    range: '192.168.1.0/24',
                    scope: 'Ip',
                    value: '1.2.3.4',
                    type: 'ban',
                    scenario: 'test'
                })
            );
        });
    });
});
