import { CrowdSecClient } from './CrowdSecClient.js';
import { createDebugger } from '../utils.js';
import { IBouncerClientOptions } from '../interfaces/index.js';
import { DecisionsBouncer } from '../Decisions/DecisionsBouncer.js';

const debug = createDebugger('bouncerClient');

export class BouncerClient extends CrowdSecClient {
    public Decisions: DecisionsBouncer;

    private auth: IBouncerClientOptions['auth'];
    constructor(options: IBouncerClientOptions) {
        super(options);

        this.auth = options.auth;
        this.setAuthenticationHeaders({
            'X-Api-Key': this.auth.apiKey
        });

        this.Decisions = new DecisionsBouncer({ httpClient: this.http });
    }

    async login(): Promise<void> {
        return this.testConnection();
    }

    public async testConnection(): Promise<void> {
        return this._testConnection('/v1/decisions');
    }

    public async stop() {
        this.Decisions.stop();
    }
}
