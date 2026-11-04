import { CrowdSecClient } from './CrowdSecClient.js';
import { createDebugger } from '../utils.js';
import { IBouncerAuthentication, IBouncerClientOptions, ITLSAuthentication } from '../interfaces/index.js';
import { LapiCapability } from '../Capabilities.js';
import { DecisionsBouncer } from '../Decisions/DecisionsBouncer.js';
import Validate from '../Validate.js';
import { CrowdsecClientError } from '../Errors/CrowdsecClientError.js';

export class BouncerClient extends CrowdSecClient {
    protected debug = createDebugger('bouncerClient');

    public Decisions: DecisionsBouncer;

    #auth?: IBouncerAuthentication;
    constructor(options: IBouncerClientOptions) {
        super(options);

        if (!options?.auth) {
            throw new CrowdsecClientError('options.auth is needed when creating a bouncer client');
        }

        if (Validate.implementsTKeys<ITLSAuthentication>(options.auth, ['key', 'cert', 'ca'])) {
            this.setAuthenticationByTLS(options.auth);
        } else {
            this.#auth = options.auth;
            this.setAuthenticationHeaders({
                'X-Api-Key': this.#auth.apiKey
            });
        }

        this.Decisions = new DecisionsBouncer({ httpClient: this.http, capabilities: this.capabilityContext });
    }

    public async login(): Promise<void> {
        await this.testConnection();

        if (this.options.detectCapabilities) {
            await this.detectCapabilities();
        }
    }

    protected collectProbes() {
        // `/v1/decisions` is reachable with a bouncer key only. A watcher JWT
        // gets 403 there, so these probes live in the bouncer client.
        //
        // The probes are deliberately selective: `/v1/decisions` has no `limit`
        // parameter, so an unfiltered request would download the whole decision
        // set twice. The filters below exercise the parameter under test while
        // matching (almost) nothing: TEST-NET-1 is never in a real deployment,
        // and an unknown origin returns an empty list.
        return [
            {
                capability: LapiCapability.containsFilter,
                request: () => this.http.get('/v1/decisions', { params: { ip: '192.0.2.1', contains: false } })
            },
            {
                capability: LapiCapability.decisionOriginsFilter,
                request: () => this.http.get('/v1/decisions', { params: { origins: 'node-crowdsec-probe' } })
            }
        ];
    }

    public async testConnection(): Promise<void> {
        return this._testConnection('/v1/decisions');
    }

    public async stop() {
        this.Decisions.stop();
    }
}
