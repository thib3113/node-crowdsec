import { describe, expect, it } from 'vitest';
import { redactBody, redactHeaders } from '../../src/Clients/CrowdSecClient.js';

describe('redactHeaders', () => {
    it('redacts sensitive headers case-insensitively', () => {
        expect(redactHeaders({ Authorization: 'Bearer x', 'X-Api-Key': 'k', Other: 'v' })).toEqual({
            Authorization: '[redacted]',
            'X-Api-Key': '[redacted]',
            Other: 'v'
        });
    });
});

describe('redactBody', () => {
    it('redacts nested fields, arrays and cycles', () => {
        const body: Record<string, unknown> = {
            token: 't',
            nested: { password: 'p', list: [{ apiKey: 'k' }] }
        };
        body.self = body;

        expect(redactBody(body)).toEqual({
            token: '[redacted]',
            nested: { password: '[redacted]', list: [{ apiKey: '[redacted]' }] },
            self: '[circular]'
        });
    });
});
