import { BaseScenario } from '../../baseScenarios/BaseScenario.js';
import { APITypes } from 'crowdsec-client';
import { IScenarioOptions } from '../IScenarioOptions.js';
import { IInternalEnricher } from './internalsEnrichers/InternalBaseEnricher.js';
import { InternalCityEnricher } from './internalsEnrichers/InternalCityEnricher.js';
import { InternalASNEnricher } from './internalsEnrichers/InternalASNEnricher.js';

interface ASNOption {
    ASN: string;
}
interface CityOption {
    city: string;
}

export interface IMaxMindOptions {
    /**
     * specify the path to ASN and/or city MaxMind files
     */
    paths: Partial<ASNOption & CityOption> & (ASNOption | CityOption);
    /**
     * Supports reloading the reader when changes occur to the database that is loaded. Default: false
     */
    watchForUpdates?: boolean;
}

declare module '../IScenarioOptions.js' {
    interface IScenarioOptions {
        maxmind?: IMaxMindOptions;
    }
}

export class MaxMindEnricher extends BaseScenario {
    static scenarioName = 'maxmind';

    private readonly currentOptions: IMaxMindOptions;
    private internalEnrichers: Array<IInternalEnricher> = [];

    constructor(options?: IScenarioOptions) {
        super(options);

        const currentOptions = options?.['maxmind'];

        if (!currentOptions) {
            throw new Error('MaxMindEnricher need "maxmind" configuration');
        }

        this.currentOptions = currentOptions;

        const { paths, watchForUpdates } = this.currentOptions;

        const internalEnrichers: Array<IInternalEnricher> = [];

        if (paths.city) {
            internalEnrichers.push(new InternalCityEnricher(paths.city));
        }

        if (paths.ASN) {
            internalEnrichers.push(new InternalASNEnricher(paths.ASN));
        }
        this.internalEnrichers = internalEnrichers;
    }

    public loaded = false;
    public async load() {
        await Promise.all(this.internalEnrichers.map((e) => e.load()));
    }

    public enrich(alert: APITypes.Alert): APITypes.Alert | undefined {
        if (this.internalEnrichers.length == 0) {
            throw new Error('MaxMindEnrich was not correctly loaded');
        }

        const alertIp = alert.source.ip;
        const partialAlertEnriched = alertIp
            ? this.internalEnrichers.reduce((currentAlert, enricher) => {
                  return enricher.enrichAlert(alertIp, currentAlert);
              }, alert)
            : alert;

        return this.internalEnrichers.reduce((currentAlert, enricher) => {
            currentAlert.events = currentAlert.events.map((event) => {
                const ip = event.meta.find((meta) => meta.key?.toLowerCase() === 'source_ip')?.value;
                if (!ip) {
                    return event;
                }

                return enricher.enrichEvent(ip, event, currentAlert);
            });

            return currentAlert;
        }, partialAlertEnriched);
    }
}
