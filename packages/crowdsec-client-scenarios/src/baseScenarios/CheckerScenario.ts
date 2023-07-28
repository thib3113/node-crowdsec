import { BaseScenario } from './BaseScenario.js';
import { IncomingMessage } from 'http';
import type { APITypes } from 'crowdsec-client';
import type { AddressObject } from '../utils.js';

export abstract class CheckerScenario extends BaseScenario {
    /**
     * announce current scenario to LAPI
     */
    public readonly announceToLAPI = true;
    protected abstract _check(ip: AddressObject, req: IncomingMessage): Array<APITypes.Alert> | APITypes.Alert | undefined;
}
