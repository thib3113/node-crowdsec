import { IScenarioOptions } from '../IScenarioOptions.js';
import { AddressObject, createDebugger, getIpObject } from '../../utils.js';
import { APITypes } from 'crowdsec-client';
import { EnricherScenario } from '../../baseScenarios/EnricherScenario.js';

declare module '../IScenarioOptions.js' {
    interface IScenarioOptions {
        'allow-list'?: {
            allowed?: Array<string>;
        };
    }
}

const defaultAllowed = ['127.0.0.1', '::1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'];

const debug = createDebugger('AllowListEnricher');
export class AllowListEnricher extends EnricherScenario {
    static scenarioName = 'allow-list';
    private allowed: Array<AddressObject>;
    constructor(options?: IScenarioOptions) {
        debug('construct');
        super(options);

        const currentOptions = options?.['allow-list'] || {};

        this.allowed = (currentOptions?.allowed ?? defaultAllowed).map((ip) => getIpObject(ip));
    }

    enrich(alert: APITypes.Alert): APITypes.Alert | undefined {
        debug('enrich alert');
        const sourceIp = alert.source.ip ?? alert.source.range;

        if (!sourceIp) {
            debug('not in allow list');
            return alert;
        }

        const sourceIpObject = this.getAddressObjectWithCache(sourceIp);

        if (!this.allowed.find((allowed) => sourceIpObject.isInSubnet(allowed))) {
            debug('%s not in allow list', sourceIp);
            return alert;
        }

        debug('%s is in allow list', sourceIp);

        return undefined;
    }
}
