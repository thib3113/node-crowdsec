import { IncomingMessage } from 'http';
import { APITypes } from 'crowdsec-client';
import { IIpExtractionResult, IScenario } from './IScenario.js';
import { AddressObject, getIpObject } from '../utils.js';
import { LRUCache } from 'lru-cache';
import { IScenarioOptions } from '../scenarios/IScenarioOptions.js';

/**
 * when creating a scenario, you need to add a static scenarioName
 */
export abstract class BaseScenario implements IScenario {
    static ipObjectCache: LRUCache<string, AddressObject, unknown>;

    protected get ipObjectCache(): LRUCache<string, AddressObject, unknown> {
        return BaseScenario.ipObjectCache;
    }

    static get scenarioName(): string {
        throw new Error('Static ScenarioName is not yet implemented');
    }

    public constructor(options?: IScenarioOptions) {
        if (!BaseScenario.ipObjectCache) {
            BaseScenario.ipObjectCache = new LRUCache<string, AddressObject>({
                max: options?.maxIpCache ?? 50000
            });
        }
    }

    protected getAddressObjectWithCache(address?: string): AddressObject {
        if (!address) {
            throw new Error('no address passed');
        }
        const cachedIp = this.ipObjectCache.get(address);
        if (cachedIp) {
            return cachedIp;
        }

        const addressObject = getIpObject(address);

        this.ipObjectCache.set(address, addressObject);
        return addressObject;
    }

    public get name() {
        return (this.constructor as typeof BaseScenario).scenarioName;
    }

    /**
     *
     * @param req
     */
    public extractIp?: (req: IncomingMessage) => IIpExtractionResult | undefined;

    /**
     * Implement this function in your scenario to use bucket and black-hole functionality
     * @param ip
     * @param req
     */
    protected _check(ip: AddressObject, req: IncomingMessage): Array<APITypes.Alert> | APITypes.Alert | undefined {
        return;
    }

    public check(ip: AddressObject, req: IncomingMessage): Array<APITypes.Alert> | APITypes.Alert | undefined {
        //todo handle overflow and blackholes
        return this._check(ip, req);
    }

    public enrich(alert: APITypes.Alert, req: IncomingMessage): APITypes.Alert | undefined {
        return alert;
    }
}
