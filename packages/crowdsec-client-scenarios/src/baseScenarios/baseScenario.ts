import { IncomingMessage } from 'http';
import { APITypes } from 'crowdsec-client';
import { IScenario } from './IScenario.js';
import { AddressObject, getIpObject } from '../utils.js';
import { LRUCache } from 'lru-cache';
import { IScenarioOptions } from '../scenarios/index.js';

export abstract class BaseScenario implements IScenario {
    static ipObjectCache: LRUCache<string, AddressObject, unknown>;

    protected get ipObjectCache(): LRUCache<string, AddressObject, unknown> {
        return BaseScenario.ipObjectCache;
    }

    static get scenarioName(): string {
        throw new Error('NOT YET IMPLEMENTED');
    }

    protected constructor(options?: IScenarioOptions) {
        if (!BaseScenario.ipObjectCache) {
            BaseScenario.ipObjectCache = new LRUCache<string, AddressObject>({
                max: options?.maxIpCache ?? 50000
            });
        }
    }

    protected getAddressObjectWithCache(address?: string): AddressObject {
        if (!address) {
            6;
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
    public extractIp?: (req: IncomingMessage) => string | undefined;

    check(ip: AddressObject, req: IncomingMessage): APITypes.Alert | undefined {
        return;
    }

    enrich(alert: APITypes.Alert): APITypes.Alert | undefined {
        return alert;
    }
}
