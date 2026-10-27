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

    const makeDecisionAlerts = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            created_at: new Date().toISOString(),
            decisions: [
                {
                    id: i + 1,
                    type: 'ban',
                    scope: 'Ip',
                    value: `198.51.100.${i + 1}`,
                    origin: 'cscli',
                    scenario: 'test',
                    duration: '4h',
                    until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    simulated: false
                }
            ]
        }));

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
                            until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
                    limit: 0,
                    has_active_decision: true
                })
            );
            expect(result).toContain('ban');
            expect(result).toContain('1.2.3.4');
            expect(result).toContain('Decision ID');
            expect(result).not.toContain('never');
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
                    until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
            expect(result).not.toContain('never');
        });

        it('should hide expired decisions', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([
                {
                    id: 1,
                    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    decisions: [
                        {
                            id: 1,
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            scenario: 'test',
                            duration: '-20s',
                            simulated: false
                        }
                    ]
                }
            ]);

            const result = await findTool('list_decisions')!.handler({}, ctx as any);

            expect(result).toContain('0 decisions shown');
            expect(result).not.toContain('1.2.3.4');
        });

        it('should reject invalid IP/CIDR and time filters', async () => {
            const ctx = createMockContext();
            const tool = findTool('list_decisions')!;

            await expect(tool.handler({ ip: '198.51.100' }, ctx as any)).rejects.toThrow(/valid ip or CIDR/);
            await expect(tool.handler({ since: 'banana' }, ctx as any)).rejects.toThrow(/invalid since/);
            await expect(tool.handler({ since: '10y' }, ctx as any)).rejects.toThrow(/use h, m, s or d/);
            await expect(tool.handler({ since: '2026-01-01T00:00:00Z' }, ctx as any)).rejects.toThrow(/use h, m, s or d/);
        });

        it('should allow CIDR in ip for containment', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([]);
            const tool = findTool('list_decisions')!;

            await tool.handler({ ip: '198.51.100.0/24' }, ctx as any);

            expect(ctx.watcher!.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '198.51.100.0/24',
                    contains: false
                })
            );
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
                            until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
                            until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
                            until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                            simulated: false
                        }
                    ]
                }
            ];

            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue(mockAlerts);

            const tool = findTool('list_decisions');
            const result = await tool!.handler({}, ctx as any);

            // Distinct decision IDs must all be visible
            expect(result).toContain('3 decisions shown');
            expect(result.match(/1\.2\.3\.4/g)?.length).toBe(3);
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
                        until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        simulated: false
                    }
                ]
            }));

            const ctx = createMockContext({ config: createMockConfig({ maxResults: 100 }) });
            ctx.watcher!.Alerts.search.mockResolvedValue(mockAlerts);

            const tool = findTool('list_decisions');
            const result = await tool!.handler({}, ctx as any);

            expect(result).toContain('50 more result(s) hidden');
        });

        it('should report exact hidden counts for an explicit limit', async () => {
            const alerts = makeDecisionAlerts(40);
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue(alerts);
            const tool = findTool('list_decisions')!;

            const limit40 = await tool.handler({ limit: 40 }, ctx as any);
            expect(limit40).toContain('40 decisions shown');
            expect(limit40).not.toContain('more result(s) hidden');

            const limit26 = await tool.handler({ limit: 26 }, ctx as any);
            expect(limit26).toContain('26 decisions shown');
            expect(limit26).toContain('14 more result(s) hidden');

            const limit25 = await tool.handler({ limit: 25 }, ctx as any);
            expect(limit25).toContain('25 decisions shown');
            expect(limit25).toContain('15 more result(s) hidden');

            const limit1000 = await tool.handler({ limit: 1000 }, ctx as any);
            expect(limit1000).toContain('40 decisions shown');
            expect(limit1000).not.toContain('more result(s) hidden');

            expect(ctx.watcher!.Alerts.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 0 }));
        });

        it('should hint that more results may exist when the default limit is reached', async () => {
            const ctx = createMockContext({ config: createMockConfig({ maxResults: 25 }) });
            ctx.watcher!.Alerts.search.mockResolvedValue(makeDecisionAlerts(25));

            const result = await findTool('list_decisions')!.handler({}, ctx as any);

            expect(result).toContain('25 decisions shown');
            expect(result).toContain('More results may be available');
        });

        it('should show all decisions when all=true', async () => {
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
                        until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        simulated: false
                    }
                ]
            }));

            const ctx = createMockContext({ config: createMockConfig({ maxResults: 25 }) });
            ctx.watcher!.Alerts.search.mockResolvedValue(mockAlerts);

            const result = await findTool('list_decisions')!.handler({ all: true }, ctx as any);

            expect(result).toContain('150 decisions shown');
            expect(result).not.toContain('more result(s) hidden');
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
                    type: 'Ban',
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

    describe('get_decision', () => {
        it('should return an active decision with alert context', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([
                {
                    id: 10,
                    created_at: new Date().toISOString(),
                    message: 'test alert',
                    source: { scope: 'Ip', value: '1.2.3.4' },
                    decisions: [
                        {
                            id: 123,
                            type: 'ban',
                            scope: 'Ip',
                            value: '1.2.3.4',
                            origin: 'cscli',
                            scenario: 'test',
                            duration: '1h',
                            simulated: false
                        }
                    ]
                }
            ]);

            const result = await findTool('get_decision')!.handler({ id: 123 }, ctx as any);

            expect(result).toContain('### Decision #123');
            expect(result).toContain('1.2.3.4');
            expect(result).toContain('Alert #10');
        });

        it('should reject unknown decision ids', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([]);

            await expect(findTool('get_decision')!.handler({ id: 999 }, ctx as any)).rejects.toThrow('Decision 999 not found');
        });

        it('should reject invalid decision ids', async () => {
            const ctx = createMockContext();

            await expect(findTool('get_decision')!.handler({ id: 'abc' }, ctx as any)).rejects.toThrow(
                'decision id must be a positive integer'
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

        it('should reject multiple target forms', async () => {
            const ctx = createMockContext();
            const tool = findTool('ban_ip');

            await expect(
                tool!.handler({ ip: '1.2.3.4', range: '10.0.0.0/8', value: '5.6.7.8', scope: 'Range' }, ctx as any)
            ).rejects.toThrow('Provide only one of ip, range, or scope+value');
        });

        it('should reject an invalid scope and decision type', async () => {
            const ctx = createMockContext();
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ scope: 'Bogus', value: 'x' }, ctx as any)).rejects.toThrow(/invalid scope/);
            await expect(tool!.handler({ ip: '1.2.3.4', type: 'Foo' }, ctx as any)).rejects.toThrow(/invalid decision type/);
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

        it('should reject durations without a unit before calling the LAPI', async () => {
            const ctx = createMockContext();
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ ip: '1.2.3.4', duration: '300' }, ctx as any)).rejects.toThrow(
                "invalid duration '300': use 30m, 4h or 7d"
            );
            await expect(tool!.handler({ ip: '1.2.3.4', duration: 300 }, ctx as any)).rejects.toThrow(
                "invalid duration '300': use 30m, 4h or 7d"
            );
            expect(ctx.watcher!.Alerts.pushAlerts).not.toHaveBeenCalled();
            expect(ctx.allowlists.check).not.toHaveBeenCalled();
        });

        it('should reject invalid Country and AS scope values', async () => {
            const ctx = createMockContext();
            const tool = findTool('ban_ip');

            await expect(tool!.handler({ scope: 'Country', value: 'ZZ' }, ctx as any)).rejects.toThrow(/invalid country code/);
            await expect(tool!.handler({ scope: 'AS', value: 'not-a-number' }, ctx as any)).rejects.toThrow(/invalid AS number/);
            expect(ctx.watcher!.Alerts.pushAlerts).not.toHaveBeenCalled();
        });

        it('should normalize Country and AS scope values', async () => {
            const countryCtx = createMockContext();
            countryCtx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-country']);
            await findTool('ban_ip')!.handler({ scope: 'Country', value: 'de' }, countryCtx as any);
            expect(countryCtx.watcher!.Alerts.pushAlerts).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        decisions: [expect.objectContaining({ scope: 'Country', value: 'DE' })]
                    })
                ])
            );

            const asCtx = createMockContext();
            asCtx.watcher!.Alerts.pushAlerts.mockResolvedValue(['alert-as']);
            await findTool('ban_ip')!.handler({ scope: 'AS', value: 'AS64512' }, asCtx as any);
            expect(asCtx.watcher!.Alerts.pushAlerts).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        decisions: [expect.objectContaining({ scope: 'AS', value: '64512' })]
                    })
                ])
            );
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

        it('should delete all active decisions when all=true and confirm=true', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([
                { id: 1, decisions: [{ id: 11 }] },
                { id: 2, decisions: [{ id: 12 }] }
            ]);
            ctx.watcher!.Decisions.deleteById.mockResolvedValue({ nbDeleted: '1' });
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ all: true, confirm: true }, ctx as any);

            expect(result).toContain('2 decision(s) deleted');
            expect(ctx.watcher!.Decisions.deleteById).toHaveBeenCalledTimes(2);
            expect(ctx.watcher!.Decisions.delete).not.toHaveBeenCalled();
        });

        it('should delete all active decisions for a scope when scope is provided alone', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([
                { id: 1, decisions: [{ id: 11, scope: 'Range', type: 'ban' }] },
                { id: 2, decisions: [{ id: 12, scope: 'Ip', type: 'ban' }] }
            ]);
            ctx.watcher!.Decisions.deleteById.mockResolvedValue({ nbDeleted: '1' });
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ scope: 'Range' }, ctx as any);

            expect(ctx.watcher!.Decisions.deleteById).toHaveBeenCalledWith('11');
            expect(ctx.watcher!.Decisions.deleteById).toHaveBeenCalledTimes(1);
            expect(result).toContain('1 decision(s) deleted');
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
            ctx.watcher!.Alerts.search.mockResolvedValue([{ id: 1, decisions: [{ id: 123 }] }]);
            ctx.watcher!.Decisions.deleteById.mockResolvedValue({ nbDeleted: '1' });
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ id: '123' }, ctx as any);

            expect(result).toContain('1 decision(s) deleted');
            expect(ctx.watcher!.Decisions.deleteById).toHaveBeenCalledWith('123');
        });

        it('should not report a replay as a successful deletion', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([{ id: 1, decisions: [{ id: 123 }] }]);
            ctx.watcher!.Decisions.deleteById.mockResolvedValue({ nbDeleted: '0' });
            const tool = findTool('unban_ip');

            await expect(tool!.handler({ id: '123' }, ctx as any)).rejects.toThrow('Decision 123 not found');
        });

        it('should delete decisions contained in a range', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([
                { id: 1, decisions: [{ id: 11 }] },
                { id: 2, decisions: [{ id: 12 }] }
            ]);
            ctx.watcher!.Decisions.deleteById.mockResolvedValue({ nbDeleted: '1' });
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ range: '198.51.100.0/24' }, ctx as any);

            expect(ctx.watcher!.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: '198.51.100.0/24',
                    contains: false,
                    has_active_decision: true,
                    limit: 0
                })
            );
            expect(ctx.watcher!.Decisions.deleteById).toHaveBeenCalledTimes(2);
            expect(result).toContain('2 decision(s) deleted');
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

        it('should reject unknown unban parameters', async () => {
            const ctx = createMockContext();
            const tool = findTool('unban_ip');

            await expect(tool!.handler({ since: '1h' }, ctx as any)).rejects.toThrow();
        });

        it('should reject when no id, no filters, and not all', async () => {
            const ctx = createMockContext();
            const tool = findTool('unban_ip');

            await expect(tool!.handler({}, ctx as any)).rejects.toThrow(
                'Must provide id, at least one filter, or all=true with confirm=true'
            );
        });

        it('should map scope=Ip to the ip filter and never send scope', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Decisions.delete.mockResolvedValue({ nbDeleted: '1' });
            const tool = findTool('unban_ip');

            await tool!.handler({ scope: 'Ip', value: '1.2.3.4', type: 'Ban', scenario: 'test' }, ctx as any);

            const query = ctx.watcher!.Decisions.delete.mock.calls[0][0];
            expect(query).toMatchObject({ ip: '1.2.3.4', type: 'ban', scenario: 'test' });
            expect(query).not.toHaveProperty('scope');
            expect(query).not.toHaveProperty('value');
        });

        it('should delete non-IP scopes via an active decision search', async () => {
            const ctx = createMockContext();
            ctx.watcher!.Alerts.search.mockResolvedValue([{ id: 1, decisions: [{ id: 21 }] }]);
            ctx.watcher!.Decisions.deleteById.mockResolvedValue({ nbDeleted: '1' });
            const tool = findTool('unban_ip');

            const result = await tool!.handler({ scope: 'Country', value: 'DE' }, ctx as any);

            expect(ctx.watcher!.Alerts.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    scope: 'Country',
                    value: 'DE',
                    has_active_decision: true,
                    limit: 0
                })
            );
            expect(ctx.watcher!.Decisions.deleteById).toHaveBeenCalledWith('21');
            expect(result).toContain('1 decision(s) deleted');
        });
    });
});
