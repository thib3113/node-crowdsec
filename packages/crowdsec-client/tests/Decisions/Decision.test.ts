import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockParseExpiration } = vi.hoisted(() => ({
    mockParseExpiration: vi.fn().mockReturnValue(new Date('2023-06-01T17:41:26.499Z'))
}));

vi.mock('../../src/utils.js', () => ({
    parseExpiration: mockParseExpiration
}));

describe('decision', () => {
    beforeEach(() => {
        mockParseExpiration.mockClear();
    });

    it('prefers a valid until date over the duration', async () => {
        const decision = new (await import('../../src/Decisions/Decision.js')).Decision({
            id: 1,
            origin: 'Origin',
            type: 'type',
            scope: 'Scope',
            value: 'value',
            duration: '1h54m',
            until: '2024-01-02T03:04:05.000Z',
            scenario: 'Scenario'
        });

        expect(decision.endAt.toISOString()).toBe('2024-01-02T03:04:05.000Z');
        expect(mockParseExpiration).not.toHaveBeenCalled();
    });

    it('should create a Decision object', async () => {
        const rawDecision = {
            id: 1,
            origin: 'Origin',
            type: 'type',
            scope: 'Scope',
            value: 'value',
            duration: '1h54m',
            until: 'until',
            scenario: 'Scenario',
            simulated: true
        };
        const decision = new (await import('../../src/Decisions/Decision.js')).Decision(rawDecision);

        expect(decision.id).toBe(rawDecision.id);
        expect(decision.origin).toBe(rawDecision.origin.toLowerCase());
        expect(decision.type).toBe(rawDecision.type);
        expect(decision.scope).toBe(rawDecision.scope.toLowerCase());
        expect(decision.value).toBe(rawDecision.value);
        expect(decision.duration).toBe(rawDecision.duration);
        expect(decision.until).toBe(rawDecision.until);
        expect(decision.scenario).toBe(rawDecision.scenario.toLowerCase());
        expect(decision.simulated).toBe(rawDecision.simulated);
        expect(decision.endAt.getTime()).toBe(1685641286499);

        expect(mockParseExpiration).toHaveBeenCalledWith(decision.duration);
    });

    it('should create a Decision object with empty simulated', async () => {
        const rawDecision = {
            id: 1,
            origin: 'Origin',
            type: 'type',
            scope: 'Scope',
            value: 'value',
            duration: '1h54m',
            until: 'until',
            scenario: 'Scenario'
        };
        const decision = new (await import('../../src/Decisions/Decision.js')).Decision(rawDecision);

        expect(decision.id).toBe(rawDecision.id);
        expect(decision.origin).toBe(rawDecision.origin.toLowerCase());
        expect(decision.type).toBe(rawDecision.type);
        expect(decision.scope).toBe(rawDecision.scope.toLowerCase());
        expect(decision.value).toBe(rawDecision.value);
        expect(decision.duration).toBe(rawDecision.duration);
        expect(decision.until).toBe(rawDecision.until);
        expect(decision.scenario).toBe(rawDecision.scenario.toLowerCase());
        // The LAPI may omit `simulated` (notably on `/v1/decisions`).
        expect(decision.simulated).toBeUndefined();
        expect(decision.endAt.getTime()).toBe(1685641286499);

        expect(mockParseExpiration).toHaveBeenCalledWith(decision.duration);
    });
});
