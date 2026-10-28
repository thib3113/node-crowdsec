import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APITypes } from 'crowdsec-client';
import type { AppContext } from '../../src/types.js';
import { allowlistTools } from '../../src/tools/allowlists.js';

function createMockAllowlists() {
    return {
        list: vi.fn(),
        get: vi.fn(),
        check: vi.fn(),
        bulkCheck: vi.fn()
    };
}

type MockAllowlists = ReturnType<typeof createMockAllowlists>;

function createMockContext(allowlists: MockAllowlists, maxResults = 50): AppContext {
    return {
        mode: 'watcher',
        capabilities: { read: true, write: false, allowlists: true },
        allowlists,
        config: { maxResults } as AppContext['config'],
        ensureReady: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        activeTools: []
    } as AppContext;
}

function makeAllowlist(index: number, overrides: Partial<APITypes.GetAllowlistResponse> = {}): APITypes.GetAllowlistResponse {
    return {
        name: `allowlist${index}`,
        description: `Description ${index}`,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        console_managed: false,
        items: [],
        ...overrides
    };
}

describe('allowlistTools', () => {
    let mockAllowlists: MockAllowlists;
    let mockCtx: AppContext;

    beforeEach(() => {
        mockAllowlists = createMockAllowlists();
        mockCtx = createMockContext(mockAllowlists);
        vi.clearAllMocks();
    });

    const findTool = (name: string) => {
        const tool = allowlistTools.find((t) => t.name === name);
        if (!tool) {
            throw new Error(`${name} tool not found`);
        }
        return tool;
    };

    describe('list_allowlists', () => {
        it('should render Name/Description/Created/Updated/Console/Size columns with a count summary', async () => {
            mockAllowlists.list.mockResolvedValue([
                makeAllowlist(1, {
                    name: 'allowlist1',
                    description: 'First allowlist',
                    console_managed: false,
                    items: [{ value: '1.2.3.4' }, { value: '5.6.7.8' }]
                }),
                makeAllowlist(2, {
                    name: 'allowlist2',
                    description: 'Second allowlist',
                    console_managed: true,
                    items: [{ value: '10.0.0.0/8' }]
                })
            ]);

            const result = (await findTool('list_allowlists').handler({ limit: 10 }, mockCtx)) as string;

            expect(mockAllowlists.list).toHaveBeenCalledWith();
            expect(result).toContain('| Name');
            expect(result).toContain('Description');
            expect(result).toContain('Created at');
            expect(result).toContain('Updated at');
            expect(result).toContain('Managed by Console');
            expect(result).toContain('Size');
            expect(result).toContain('allowlist1');
            expect(result).toContain('First allowlist');
            expect(result).toContain('no');
            expect(result).toContain('allowlist2');
            expect(result).toContain('yes');
            expect(result).toContain('2 allowlists');
            expect(result).not.toContain('"items"');
        });

        it('should use with_content=true by default via the port', async () => {
            mockAllowlists.list.mockResolvedValue([makeAllowlist(0, { name: 'al1', description: 'd' })]);

            await findTool('list_allowlists').handler({}, mockCtx);

            expect(mockAllowlists.list).toHaveBeenCalledWith();
        });

        it('should truncate rows to the requested limit and hint at hidden rows', async () => {
            mockAllowlists.list.mockResolvedValue(Array.from({ length: 10 }, (_, i) => makeAllowlist(i)));

            const result = (await findTool('list_allowlists').handler({ limit: 3 }, mockCtx)) as string;

            expect(result).toContain('allowlist0');
            expect(result).toContain('allowlist2');
            expect(result).not.toContain('allowlist3');
            expect(result).toContain('7 more result(s) hidden');
            expect(result).toContain('10 allowlists');
        });

        it('should render markdown for an empty list', async () => {
            mockAllowlists.list.mockResolvedValue([]);

            const result = (await findTool('list_allowlists').handler({}, mockCtx)) as string;

            expect(result).toContain('_No results._');
            expect(result).toContain('0 allowlists');
        });
    });

    describe('get_allowlist', () => {
        it('should show info bullets and a Value/Comment/Expiration/Created items table when with_content=true', async () => {
            mockAllowlists.get.mockResolvedValue({
                name: 'test-allowlist',
                description: 'Test description',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
                console_managed: false,
                items: [
                    {
                        value: '192.168.1.1',
                        description: 'Local IP',
                        created_at: '2024-01-01T00:00:00Z',
                        expiration: '2030-01-01T00:00:00Z'
                    },
                    { value: '10.0.0.0/8', description: 'Private range', created_at: '2024-01-02T00:00:00Z', expiration: undefined }
                ]
            } satisfies APITypes.GetAllowlistResponse);

            const result = (await findTool('get_allowlist').handler(
                { name: 'test-allowlist', with_content: true, limit: 10 },
                mockCtx
            )) as string;

            expect(mockAllowlists.get).toHaveBeenCalledWith('test-allowlist', true);
            expect(result).toContain('**test-allowlist**');
            expect(result).toContain('Description: Test description');
            expect(result).toContain('Created at: 2024-01-01T00:00:00Z');
            expect(result).toContain('Updated at: 2024-01-02T00:00:00Z');
            expect(result).toContain('Managed by Console: no');
            expect(result).toContain('| Value');
            expect(result).toContain('Comment');
            expect(result).toContain('Expiration');
            expect(result).toContain('192.168.1.1');
            expect(result).toContain('Local IP');
            expect(result).toContain('10.0.0.0/8');
            expect(result).toContain('Private range');
            expect(result).not.toContain('"items"');
        });

        it('should render the year-1 sentinel as never', async () => {
            mockAllowlists.get.mockResolvedValue({
                name: 'no-expiry',
                description: 'No expiry',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                console_managed: false,
                items: [
                    {
                        value: '1.2.3.4',
                        description: 'Permanent entry',
                        created_at: '2024-01-01T00:00:00Z',
                        expiration: '0001-01-01T00:00:00Z'
                    }
                ]
            } satisfies APITypes.GetAllowlistResponse);

            const result = (await findTool('get_allowlist').handler({ name: 'no-expiry' }, mockCtx)) as string;

            expect(result).toContain('never');
            expect(result).not.toContain('0001-01-01');
        });

        it('should trim allowlist names before calling the LAPI', async () => {
            mockAllowlists.get.mockResolvedValue(makeAllowlist(0, { name: 'test-allowlist' }));

            await findTool('get_allowlist').handler({ name: '  test-allowlist  ' }, mockCtx);

            expect(mockAllowlists.get).toHaveBeenCalledWith('test-allowlist', true);
            await expect(findTool('get_allowlist').handler({ name: '   ' }, mockCtx)).rejects.toThrow(/Allowlist name is required/);
        });

        it('should map a missing allowlist to a business error', async () => {
            mockAllowlists.get.mockRejectedValue(new Error("CrowdSecError (500) : allowlist 'nope' not found"));

            await expect(findTool('get_allowlist').handler({ name: 'nope' }, mockCtx)).rejects.toThrow("Allowlist 'nope' not found");
        });

        it('should show only info and _Content hidden when with_content=false even if items exist', async () => {
            mockAllowlists.get.mockResolvedValue({
                name: 'test-allowlist',
                description: 'Test',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                console_managed: false,
                items: [{ value: '1.2.3.4', description: 'IP', created_at: '2024-01-01T00:00:00Z', expiration: undefined }]
            } satisfies APITypes.GetAllowlistResponse);

            const result = (await findTool('get_allowlist').handler({ name: 'test-allowlist', with_content: false }, mockCtx)) as string;

            expect(mockAllowlists.get).toHaveBeenCalledWith('test-allowlist', false);
            expect(result).toContain('**test-allowlist**');
            expect(result).toContain('_Content hidden (with_content=false)._');
            expect(result).not.toContain('Value | Comment');
        });

        it('should show _No items._ for an empty items array', async () => {
            mockAllowlists.get.mockResolvedValue(
                makeAllowlist(0, { name: 'empty-allowlist', description: 'Empty', console_managed: true, items: [] })
            );

            const result = (await findTool('get_allowlist').handler({ name: 'empty-allowlist', with_content: true }, mockCtx)) as string;

            expect(result).toContain('_No items._');
            expect(result).not.toContain('| Value');
        });

        it('should show _No items._ when items are undefined', async () => {
            mockAllowlists.get.mockResolvedValue({
                name: 'no-content-allowlist',
                description: 'No content',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                console_managed: false,
                items: undefined
            } satisfies APITypes.GetAllowlistResponse);

            const result = (await findTool('get_allowlist').handler(
                { name: 'no-content-allowlist', with_content: true },
                mockCtx
            )) as string;

            expect(result).toContain('**no-content-allowlist**');
            expect(result).toContain('_No items._');
        });

        it('should truncate items when limit is exceeded', async () => {
            const manyItems: APITypes.AllowlistItem[] = Array.from({ length: 10 }, (_, i) => ({
                value: `192.168.1.${i}`,
                description: `Item ${i}`,
                created_at: '2024-01-01T00:00:00Z',
                expiration: undefined
            }));
            mockAllowlists.get.mockResolvedValue(makeAllowlist(0, { name: 'test-allowlist', description: 'Test', items: manyItems }));

            const result = (await findTool('get_allowlist').handler(
                { name: 'test-allowlist', with_content: true, limit: 3 },
                mockCtx
            )) as string;

            expect(result).toContain('192.168.1.0');
            expect(result).toContain('192.168.1.2');
            expect(result).not.toContain('192.168.1.3');
            expect(result).toContain('7 more result(s) hidden');
        });
    });

    describe('check_allowlist', () => {
        it('should check a single allowlisted value via check()', async () => {
            mockAllowlists.check.mockResolvedValue({
                allowlisted: true,
                reason: 'test-allowlist: Local network'
            } satisfies APITypes.CheckAllowlistResponse);

            const result = (await findTool('check_allowlist').handler({ value: '192.168.1.1' }, mockCtx)) as string;

            expect(mockAllowlists.check).toHaveBeenCalledWith('192.168.1.1');
            expect(mockAllowlists.bulkCheck).not.toHaveBeenCalled();
            expect(result).toContain('192.168.1.1: allowlisted by test-allowlist: Local network');
            expect(result).toContain('1 target of 1 target matched an allowlist.');
        });

        it('should fall back to a generic label when a single check has no reason', async () => {
            mockAllowlists.check.mockResolvedValue({ allowlisted: true, reason: undefined } satisfies APITypes.CheckAllowlistResponse);

            const result = (await findTool('check_allowlist').handler({ value: '192.168.1.1' }, mockCtx)) as string;

            expect(result).toContain('192.168.1.1: allowlisted by allowlist');
            expect(result).toContain('1 target of 1 target matched an allowlist.');
        });

        it('should check a single value that is not allowlisted', async () => {
            mockAllowlists.check.mockResolvedValue({ allowlisted: false, reason: undefined } satisfies APITypes.CheckAllowlistResponse);

            const result = (await findTool('check_allowlist').handler({ value: '8.8.8.8' }, mockCtx)) as string;

            expect(result).toContain('8.8.8.8: not allowlisted');
            expect(result).toContain('0 targets of 1 target matched an allowlist.');
        });

        it('should distinguish a CIDR match from an exact IP match', async () => {
            mockAllowlists.check.mockResolvedValue({
                allowlisted: true,
                reason: '192.0.2.10'
            } satisfies APITypes.CheckAllowlistResponse);

            const result = (await findTool('check_allowlist').handler({ value: '192.0.2.0/24' }, mockCtx)) as string;

            expect(result).toContain('192.0.2.0/24: CIDR matches allowlist entry/entries 192.0.2.10');
        });

        it('should trim checked values before calling the LAPI', async () => {
            mockAllowlists.check.mockResolvedValue({ allowlisted: false } satisfies APITypes.CheckAllowlistResponse);

            await findTool('check_allowlist').handler({ value: ' 192.168.1.1 ' }, mockCtx);

            expect(mockAllowlists.check).toHaveBeenCalledWith('192.168.1.1');
        });

        it('should treat bulk targets missing from results as not allowlisted', async () => {
            mockAllowlists.bulkCheck.mockResolvedValue({
                results: [
                    { target: '192.168.1.1', allowlists: ['allowlist1: Local'] },
                    { target: '10.0.0.0/8', allowlists: ['allowlist1: Private', 'allowlist2: RFC1918'] }
                ]
            } satisfies APITypes.BulkCheckAllowlistResponse);

            const result = (await findTool('check_allowlist').handler(
                { values: ['192.168.1.1', '10.0.0.0/8', '8.8.8.8'] },
                mockCtx
            )) as string;

            expect(mockAllowlists.bulkCheck).toHaveBeenCalledWith(['192.168.1.1', '10.0.0.0/8', '8.8.8.8']);
            expect(result).toContain('192.168.1.1: allowlisted by allowlist1: Local');
            expect(result).toContain('10.0.0.0/8: CIDR matches allowlist entry/entries allowlist1: Private, allowlist2: RFC1918');
            expect(result).toContain('8.8.8.8: not allowlisted');
            expect(result).toContain('2 targets of 3 targets matched an allowlist.');
        });

        it('should preserve input order of bulk targets in output', async () => {
            mockAllowlists.bulkCheck.mockResolvedValue({
                results: [
                    { target: '10.0.0.1', allowlists: ['al1'] },
                    { target: '192.168.1.1', allowlists: ['al2'] },
                    { target: '172.16.0.1', allowlists: [] }
                ]
            } satisfies APITypes.BulkCheckAllowlistResponse);

            const result = (await findTool('check_allowlist').handler(
                { values: ['192.168.1.1', '10.0.0.1', '172.16.0.1'] },
                mockCtx
            )) as string;

            const lines = result.split('\n').filter((line) => line.startsWith('-'));
            expect(lines[0]).toContain('192.168.1.1');
            expect(lines[1]).toContain('10.0.0.1');
            expect(lines[2]).toContain('172.16.0.1');
        });

        it('should deduplicate bulk targets', async () => {
            mockAllowlists.bulkCheck.mockResolvedValue({
                results: [{ target: '192.0.2.10', allowlists: ['test'] }]
            } satisfies APITypes.BulkCheckAllowlistResponse);

            const result = (await findTool('check_allowlist').handler(
                { values: ['192.0.2.10', '192.0.2.10', '8.8.8.8'] },
                mockCtx
            )) as string;

            expect(mockAllowlists.bulkCheck).toHaveBeenCalledWith(['192.0.2.10', '8.8.8.8']);
            expect(result.split('\n').filter((line) => line.startsWith('-'))).toHaveLength(2);
            expect(result).toContain('1 target of 2 targets matched an allowlist');
        });

        it('should reject value and values together', async () => {
            await expect(findTool('check_allowlist').handler({ value: '192.0.2.10', values: ['192.0.2.11'] }, mockCtx)).rejects.toThrow();
            expect(mockAllowlists.check).not.toHaveBeenCalled();
            expect(mockAllowlists.bulkCheck).not.toHaveBeenCalled();
        });

        it('should reject an empty values array', async () => {
            await expect(findTool('check_allowlist').handler({ values: [] }, mockCtx)).rejects.toThrow();
            expect(mockAllowlists.check).not.toHaveBeenCalled();
            expect(mockAllowlists.bulkCheck).not.toHaveBeenCalled();
        });

        it('should reject when neither value nor values is provided', async () => {
            await expect(findTool('check_allowlist').handler({}, mockCtx)).rejects.toThrow();
            expect(mockAllowlists.check).not.toHaveBeenCalled();
            expect(mockAllowlists.bulkCheck).not.toHaveBeenCalled();
        });

        it('should reject an empty string value', async () => {
            await expect(findTool('check_allowlist').handler({ value: '' }, mockCtx)).rejects.toThrow();
            expect(mockAllowlists.check).not.toHaveBeenCalled();
            expect(mockAllowlists.bulkCheck).not.toHaveBeenCalled();
        });
    });
});
