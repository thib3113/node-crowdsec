import type { Decision as rawDecision, decisionOrigin, decisionType } from '../types/index.js';
import { parseExpiration } from '../utils.js';

export class Decision<Scope extends string = 'ip', Origin extends string = decisionOrigin, Type extends string = decisionType> {
    public id?: number;
    public origin: Origin;
    public type: Type;
    public scope: Scope;
    public value: string;
    public duration: string;
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
        this.simulated = decision.simulated ?? false;

        this.endAt = parseExpiration(this.duration);
    }
}
