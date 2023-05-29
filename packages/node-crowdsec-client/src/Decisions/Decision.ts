import type * as crowdsecTypes from 'crowdsec-types';
import { parseExpiration } from '../utils.js';

export class Decision {
    public id?: number;
    public origin: crowdsecTypes.decisionOrigin;
    public type: crowdsecTypes.decisionType;
    public scope: crowdsecTypes.decisionScope;
    public value: string;
    public duration: string;
    public until: string | undefined;
    public scenario: string;
    public endAt: Date;
    public simulated?: boolean;

    constructor(decision: crowdsecTypes.Decision) {
        this.id = decision.id;
        this.origin = decision.origin;
        this.type = decision.type;
        this.scope = decision.scope;
        this.value = decision.value;
        this.duration = decision.duration;
        this.until = decision.until;
        this.scenario = decision.scenario;
        this.simulated = decision.simulated ?? false;

        this.endAt = parseExpiration(this.duration);
    }
}
