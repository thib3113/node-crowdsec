import { APITypes } from 'crowdsec-client';
import { InternalBaseEnricher } from './InternalBaseEnricher.js';
import type { CityResponse } from 'maxmind';
import { createDebugger, mergeMetas } from '../../../utils.js';

const debug = createDebugger('MaxMind:InternalASNEnricher');
export class InternalCityEnricher extends InternalBaseEnricher<CityResponse> {
    protected databaseType = 'GeoLite2-City';
    protected debug = debug;
    public enrichEvent(ip: string, event: APITypes.Event): APITypes.Event {
        if (!this.database) {
            throw new Error('database seems incorrectly loaded');
        }

        const result = this.database.get(ip);

        if (!result) {
            return event;
        }

        const { latitude, longitude } = result.location || {};

        const meta: Record<string, string | undefined> = {
            SourceRange: `${ip}/${prefix}`,
            cn: result.country?.iso_code,
            latitude: latitude?.toString(),
            longitude: longitude?.toString(),
            IsInEU: (result.registered_country?.is_in_european_union || false).toString()
        };

        event.meta = mergeMetas(event.meta, meta);

        return event;
    }
    enrichAlert(ip: string, alert: APITypes.Alert): APITypes.Alert {
        if (!this.database) {
            throw new Error('database seems incorrectly loaded');
        }

        const [result, prefix] = this.database.getWithPrefixLength(ip);

        if (result) {
            alert.source = {
                range: `${ip}/${prefix}`,
                ...alert.source,
                cn: result.country?.iso_code,
                latitude: result.location?.latitude,
                longitude: result.location?.longitude
            };
        }

        return alert;
    }
}
