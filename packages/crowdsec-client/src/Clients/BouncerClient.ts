import { CrowdSecClient } from './CrowdSecClient.js';
import { createDebugger } from '../utils.js';
import { IBouncerAuthentication, IBouncerClientOptions, ITLSAuthentication } from '../interfaces/index.js';
import { DecisionsBouncer } from '../Decisions/DecisionsBouncer.js';
import Validate from '../Validate.js';
import { CrowdsecClientError } from '../Errors/CrowdsecClientError.js';

const debug = createDebugger('bouncerClient');

export class BouncerClient extends CrowdSecClient {
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

        this.Decisions = new DecisionsBouncer({ httpClient: this.http });
    }

    public async login(): Promise<void> {
        return this.testConnection();
    }

    public async testConnection(): Promise<void> {
        return this._testConnection('/v1/decisions');
    }

    public async stop() {
        this.Decisions.stop();
    }
}
