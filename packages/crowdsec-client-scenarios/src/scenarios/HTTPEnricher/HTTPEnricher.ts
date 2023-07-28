import { IScenarioOptions } from '../IScenarioOptions.js';
import { createDebugger, mergeMetas } from '../../utils.js';
import { APITypes } from 'crowdsec-client';
import { IncomingMessage } from 'http';
import { EnricherScenario } from '../../baseScenarios/EnricherScenario.js';

const debug = createDebugger('HTTPEnricher');
export class HTTPEnricher extends EnricherScenario {
    static scenarioName = 'http-enricher';

    public constructor(options?: IScenarioOptions) {
        debug('construct');
        super(options);
    }

    enrich(alert: APITypes.Alert, req: IncomingMessage): APITypes.Alert | undefined {
        const url = new URL(req.url || '', 'http://localhost');

        //allow to get 0 when only ? . and 0 when nothing
        const http_args_len = String((url.search.length || 1) - 1);

        const metas: Record<string, string | undefined> = {
            http_args_len,
            http_path: req.url,
            http_user_agent: req.headers['user-agent'],
            http_verb: req.method,
            service: 'http'
        };

        alert.events = alert.events.map((e) => ({ ...e, meta: mergeMetas(e.meta, metas) }));

        return alert;
    }
}
