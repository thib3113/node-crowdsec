import { IncomingMessage } from 'http';
import { APITypes } from 'crowdsec-client';
import { AddressObject } from '../utils.js';
import { IScenarioOptions } from '../scenarios/index.js';

export interface IScenario {
    name: string;
    load?: () => Promise<void>;
    loaded?: boolean;
    check?: (ip: AddressObject, req: IncomingMessage) => APITypes.Alert | undefined;
    enrich?: (alert: APITypes.Alert) => APITypes.Alert | undefined;
    /**
     * allow some scenario to extract ip from the request
     * @param req
     */
    extractIp?: (req: IncomingMessage) => string | undefined;
}

export type IScenarioConstructor = new (option?: IScenarioOptions) => IScenario;
