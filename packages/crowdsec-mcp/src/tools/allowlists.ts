import { z } from 'zod';
import type { ToolDefinition } from '../types.js';
import { formatAllowlistList, formatAllowlistDetail, formatAllowlistCheck } from '../format/allowlists.js';

const ListAllowlistsInput = z.object({
    limit: z.number().int().positive().optional().describe('Maximum number of allowlists to display')
});

const GetAllowlistInput = z.object({
    name: z.string().min(1, 'Allowlist name is required').describe('Name of the allowlist to inspect'),
    with_content: z.boolean().default(true).describe('Include allowlist items in the response'),
    limit: z.number().int().positive().optional().describe('Maximum number of items to display')
});

const CheckAllowlistInput = z
    .object({
        value: z.string().min(1).optional().describe('Single value (IP, range, username, etc.) to check'),
        values: z.array(z.string().min(1)).optional().describe('Multiple values to check in bulk')
    })
    .refine((data) => data.value !== undefined || (data.values !== undefined && data.values.length > 0), {
        message: 'At least one of `value` or `values` must be provided and non-empty'
    });

export const allowlistTools: ToolDefinition[] = [
    {
        name: 'list_allowlists',
        title: 'List allowlists',
        description:
            'List all allowlists with their name, description, creation/update dates, console management status, and item count. Mirrors `cscli allowlists list`.',
        inputSchema: ListAllowlistsInput,
        kind: 'read',
        requires: ['watcher', 'allowlists'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            const { limit } = ListAllowlistsInput.parse(input);
            const allowlists = await ctx.allowlists.list();

            return formatAllowlistList(allowlists, limit ?? ctx.config.maxResults);
        }
    },
    {
        name: 'get_allowlist',
        title: 'Get allowlist details',
        description: 'Get detailed information about a specific allowlist including its items. Mirrors `cscli allowlists inspect`.',
        inputSchema: GetAllowlistInput,
        kind: 'read',
        requires: ['watcher', 'allowlists'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            const { name, with_content: withContent, limit } = GetAllowlistInput.parse(input);

            const allowlist = await ctx.allowlists.get(name, withContent);

            return formatAllowlistDetail(allowlist, withContent, limit ?? ctx.config.maxResults);
        }
    },
    {
        name: 'check_allowlist',
        title: 'Check allowlist membership',
        description:
            'Check if one or more values (IPs, ranges, usernames, etc.) are present in any allowlist. Provide either a single `value` or an array of `values`.',
        inputSchema: CheckAllowlistInput,
        kind: 'read',
        requires: ['watcher', 'allowlists'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
            await ctx.ensureReady();

            const { value, values } = CheckAllowlistInput.parse(input);

            const targets: string[] = values?.length ? values : value ? [value] : [];

            if (targets.length === 0) {
                throw new Error('At least one of `value` or `values` must be provided and non-empty');
            }

            if (targets.length === 1) {
                const result = await ctx.allowlists.check(targets[0]);
                return formatAllowlistCheck(
                    targets,
                    result.allowlisted ? [{ target: targets[0], allowlists: [result.reason || 'allowlist'] }] : []
                );
            }

            const bulkResult = await ctx.allowlists.bulkCheck(targets);
            return formatAllowlistCheck(targets, bulkResult.results ?? []);
        }
    }
];
