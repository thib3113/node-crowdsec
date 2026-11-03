import type { APITypes } from 'crowdsec-client';
import type { IncomingMessage } from 'http';
import type { AddressObject } from './utils.js';

/**
 * Minimal structural types for the optional `crowdsec-client-scenarios`
 * package. The published middleware must not depend on that devDependency at
 * type-resolution time (bouncer-only consumers do not install it).
 */
export interface IScenarioOptions {
    maxIpCache?: number;
    'x-forwarded-for'?: unknown;
    maxmind?: unknown;
    'allow-list'?: unknown;
}

export interface IIpExtractionResult {
    ip: string;
    confidence: number;
}

export interface IScenario {
    name: string;
    announceToLAPI?: boolean;
    load?: () => Promise<void>;
    loaded?: boolean;
    check?: (ip: AddressObject, req: IncomingMessage) => APITypes.Alert | Array<APITypes.Alert> | undefined;
    enrich?: (alert: APITypes.Alert, req: IncomingMessage) => APITypes.Alert | undefined;
    extractIp?: (req: IncomingMessage) => IIpExtractionResult | undefined;
}

export type IScenarioConstructor = new (option?: any) => IScenario;
