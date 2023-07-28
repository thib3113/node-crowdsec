import { IncomingMessage } from 'http';
import { APITypes } from 'crowdsec-client';
import { AddressObject } from '../utils.js';
import { IScenarioOptions } from '../scenarios/index.js';

export const MAX_CONFIDENCE = 10;
export interface IIpExtractionResult {
    ip: string;
    /**
     * confidence of the ip extraction between 0 and 10
     */
    confidence: number;
}

export interface IScenario {
    /**
     * name of the scenario
     */
    name: string;
    /**
     * announce current scenario to LAPI
     */
    announceToLAPI?: boolean;
    /**
     * promise to load the scenario
     */
    load?: () => Promise<void>;
    /**
     * is the scenario loaded ?
     */
    loaded?: boolean;
    check?: (ip: AddressObject, req: IncomingMessage) => Array<APITypes.Alert> | APITypes.Alert | undefined;
    enrich?: (alert: APITypes.Alert, req: IncomingMessage) => APITypes.Alert | undefined;
    /**
     * allow some scenario to extract ip from the request
     * @param req
     */
    extractIp?: (req: IncomingMessage) => IIpExtractionResult | undefined;
}

export type IScenarioConstructor = new (option?: IScenarioOptions) => IScenario;
