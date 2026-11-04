import type { Decision as rawDecision, decisionOrigin, decisionType } from '../types/index.js';
import { parseExpiration } from '../utils.js';

/**
 * Represent a Decision .
 */
export class Decision<Scope extends string = 'ip', Origin extends string = decisionOrigin, Type extends string = decisionType> {
    public id?: number;
    public origin: Origin;
    public type: Type;
    public scope: Scope;
    public value: string;
    public duration: string;
    /**
     * Exact expiration date reported by the LAPI.
     * @since CrowdSec 1.3.0
     * @remarks `undefined` on older LAPIs; `endAt` is then computed from `duration`.
     */
    public until: string | undefined;
    public scenario: string;
    public endAt: Date;
    public simulated?: boolean;

    constructor(decision: rawDecision) {
        this.id = decision.id;
        this.origin = decision.origin?.toLowerCase() as Origin;
        this.type = decision.type as Type;
        this.scope = decision.scope?.toLowerCase() as Scope;
        this.value = decision.value;
        this.duration = decision.duration;
        this.until = decision.until;
        this.scenario = decision.scenario?.toLowerCase();
        // Keep `undefined` when the LAPI does not return the field (notably
        // `/v1/decisions`), so callers can tell "not simulated" from "unknown".
        this.simulated = decision.simulated;

        const until = this.until ? new Date(this.until) : undefined;
        this.endAt = until && !Number.isNaN(until.getTime()) ? until : parseExpiration(this.duration);
    }
}
