import { BaseScenario } from '../baseScenarios/baseScenario.js';
import { APITypes } from 'crowdsec-client';
import { IScenarioOptions } from './IScenarioOptions.js';
import maxmind, { Reader, CityResponse, AsnResponse } from 'maxmind';
import * as fs from 'fs';

declare module './IScenarioOptions.js' {
    interface IScenarioOptions {
        maxmind?: {
            path: string;
        };
    }
}

// TODO WIP
export class MaxMindEnrich extends BaseScenario {
    static scenarioName: 'maxmind';
    private readonly path: string;

    private cityLookup?: Reader<CityResponse & AsnResponse>;

    constructor(options?: IScenarioOptions) {
        super(options);

        const currentOptions = options?.['maxmind'];

        if (!currentOptions?.path) {
            throw new Error('path option is needed . please setup it to your maxmind path');
        }

        if (!fs.existsSync(currentOptions.path)) {
            throw new Error(`path "${currentOptions.path}" seems to doesn't exist`);
        }

        this.path = currentOptions.path;
    }

    public loaded = false;
    public async load() {
        this.cityLookup = await maxmind.open<CityResponse & AsnResponse>(this.path);
    }

    public enrich(alert: APITypes.Alert): APITypes.Alert | undefined {
        if (!this.cityLookup) {
            throw new Error('MaxMindEnrich was not correctly loaded');
        }

        //todo test with range
        const ip = alert.source.ip;
        if (ip) {
            const [result, prefix] = this.cityLookup.getWithPrefixLength(ip);

            if (result) {
                alert.source = {
                    as_name: result.autonomous_system_organization,
                    as_number: result.autonomous_system_number?.toString(),
                    range: `${ip}/${prefix}`,
                    cn: result.country?.iso_code,
                    latitude: result.location?.latitude,
                    longitude: result.location?.longitude,
                    ...alert.source
                };
            }
        }

        alert.events = (alert.events || []).map((event) => {
            const ip = event.meta.find((meta) => meta.key?.toLowerCase() === 'source_ip')?.value;
            if (!ip) {
                return event;
            }

            const [result, prefix] = this.cityLookup!.getWithPrefixLength(ip);

            if (!result) {
                return event;
            }

            const meta: Record<string, string | undefined> = {
                ASNNumber: result.autonomous_system_number.toString(),
                ASNOrg: result.autonomous_system_organization,
                IsInEU: result.country?.is_in_european_union?.toString(),
                IsoCode: result.country?.iso_code,
                SourceRange: `${ip}/${prefix}`
            };

            event.meta = Object.entries(meta || {}).reduce((values, [key, value]) => {
                if (values.find((value) => key === value.key) || !value) {
                    return values;
                }

                values.push({ key, value });
                return values;
            }, event.meta);

            return event;
        });

        return super.enrich(alert);
    }
}
