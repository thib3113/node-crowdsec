import { z } from 'zod';
import type { ToolDefinition } from '../types.js';
import { formatAllowlistList, formatAllowlistDetail, formatAllowlistCheck } from '../format/allowlists.js';
import { cleanErrorMessage } from '../registry.js';
import { isValidCidr, isValidIp } from '../utils.js';

const ListAllowlistsInput = z
    .object({
        limit: z.number().int().positive().optional().describe('Maximum number of allowlists to display')
    })
    .strict();

const GetAllowlistInput = z
    .object({
        name: z.string().trim().min(1, 'Allowlist name is required').describe('Name of the allowlist to inspect'),
        with_content: z.boolean().default(true).describe('Include allowlist items in the response'),
        limit: z.number().int().positive().optional().describe('Maximum number of items to display')
    })
    .strict();

const CheckAllowlistInput = z
    .object({
        value: z.string().trim().min(1).optional().describe('Single IP or CIDR range to check'),
        values: z.array(z.string().trim().min(1)).optional().describe('Multiple IPs or CIDR ranges to check in bulk')
    })
    .strict()
    .refine((data) => data.value !== undefined || (data.values !== undefined && data.values.length > 0), {
        message: 'At least one of `value` or `values` must be provided and non-empty'
    })
    .refine((data) => !(data.value !== undefined && data.values !== undefined && data.values.length > 0), {
        message: 'Provide either `value` or `values`, not both'
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
            const { name, with_content: withContent, limit } = GetAllowlistInput.parse(input);

            try {
                const allowlist = await ctx.allowlists.get(name, withContent);
                return formatAllowlistDetail(allowlist, withContent, limit ?? ctx.config.maxResults);
            } catch (error) {
                const message = cleanErrorMessage(error);
                if (/not found/i.test(message)) {
                    throw new Error(`Allowlist '${name}' not found`);
                }
                throw error;
            }
        }
    },
    {
        name: 'check_allowlist',
        title: 'Check allowlist membership',
        description:
            'Check whether one or more IPs or CIDR ranges match any allowlist entry. A CIDR can match because it contains an allowlisted IP; the output distinguishes CIDR matches from exact IP matches. Provide either a single `value` or an array of `values`.',
        inputSchema: CheckAllowlistInput,
        kind: 'read',
        requires: ['watcher', 'allowlists'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (input, ctx) => {
            const { value, values } = CheckAllowlistInput.parse(input);

            const targets: string[] = [...(values ?? []), ...(value ? [value] : [])];
            const uniqueTargets = [...new Set(targets)];

            if (uniqueTargets.length === 0) {
                throw new Error('At least one of `value` or `values` must be provided and non-empty');
            }

            for (const target of uniqueTargets) {
                if (!isValidIp(target) && !isValidCidr(target)) {
                    throw new Error(`check_allowlist supports IPs and CIDR ranges only; '${target}' is not valid`);
                }
            }

            // Always use the bulk endpoint, even for a single target: it returns
            // the allowlist names, while the single-value endpoint only returns
            // the matched item. This keeps the output consistent.
            const bulkResult = await ctx.allowlists.bulkCheck(uniqueTargets);
            return formatAllowlistCheck(uniqueTargets, bulkResult.results ?? []);
        }
    }
];
