import { describe, expect, it, jest } from '@jest/globals';

const mockParseExpiration = jest.fn().mockReturnValue(new Date('2023-06-01T17:41:26.499Z'));

jest.unstable_mockModule('../../src/utils.js', () => ({
    parseExpiration: mockParseExpiration
}));

describe('decision', () => {
    it('should create a Decision object', async () => {
        const rawDecision = {
            id: 1,
            origin: 'Origin',
            type: 'type',
            scope: 'Scope',
            value: 'value',
            duration: 'duration',
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
            duration: 'duration',
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
        expect(decision.simulated).toBe(false);
        expect(decision.endAt.getTime()).toBe(1685641286499);

        expect(mockParseExpiration).toHaveBeenCalledWith(decision.duration);
    });
});
