import { BaseScenario } from './BaseScenario.js';
import { IncomingMessage } from 'http';
import type { APITypes } from 'crowdsec-client';

export abstract class EnricherScenario extends BaseScenario {
    public abstract enrich(alert: APITypes.Alert, req: IncomingMessage): APITypes.Alert | undefined;
}
