import { APITypes } from 'crowdsec-client';
import { InternalBaseEnricher } from './InternalBaseEnricher.js';
import type { AsnResponse } from 'maxmind';
import { createDebugger, mergeMetas } from '../../../utils.js';

const debug = createDebugger('MaxMind:InternalASNEnricher');
export class InternalASNEnricher extends InternalBaseEnricher<AsnResponse> {
    protected databaseType = 'GeoLite2-ASN';
    protected debug = debug;
    public enrichEvent(ip: string, event: APITypes.Event): APITypes.Event {
        if (!this.database) {
            throw new Error('database seems incorrectly loaded');
        }

        const result = this.database.get(ip);

        if (!result) {
            return event;
        }

        const meta: Record<string, string | undefined> = {
            ASNNumber: result.autonomous_system_number.toString(),
            ASNOrg: result.autonomous_system_organization
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
                as_name: result.autonomous_system_organization,
                as_number: result.autonomous_system_number?.toString()
            };
        }

        return alert;
    }
}
