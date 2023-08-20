import { getCurrentIpFn, ICrowdSecHTTPMiddlewareOptions, ICrowdSecHTTPWatcherMiddlewareOptions } from './ICrowdSecHTTPMiddlewareOptions.js';
import Validate from './Validate.js';
import { APITypes, Decision, ICrowdSecClientOptions, ITLSAuthentication, IWatcherAuthentication, WatcherClient } from 'crowdsec-client';
import { IpObjectsCacher } from './IpObjectsCacher.js';
import { IncomingMessage } from 'http';
import { BaseScenario, IIpExtractionResult, IScenario, IScenarioConstructor, MAX_CONFIDENCE } from 'crowdsec-client-scenarios';
import { CommonsMiddleware } from './CommonsMiddleware.js';

const SCENARIOS_PACKAGE_NAME = 'crowdsec-client-scenarios';

/**
 * TODO
 *
 * only ip extraction was tested
 */

export class CrowdSecHTTPWatcherMiddleware extends CommonsMiddleware {
    private readonly clientOptions: ICrowdSecClientOptions;
    public readonly client: WatcherClient;
    private scenarios: Array<IScenario> = [];
    private defaultScenarios: Array<IScenarioConstructor> = [];
    private options: ICrowdSecHTTPWatcherMiddlewareOptions;
    private ipObjectCache: IpObjectsCacher;

    constructor(options: ICrowdSecHTTPWatcherMiddlewareOptions, clientOptions: ICrowdSecClientOptions, cache?: IpObjectsCacher) {
        super('CrowdSecHTTPWatcherMiddleware', options.logger);
        this.logger.debug('construct');

        this.options = options;
        this.clientOptions = clientOptions;

        const auth = this.getWatcherAuthentication(options);

        this.client = new WatcherClient({
            url: this.clientOptions.url,
            userAgent: this.clientOptions.userAgent,
            timeout: this.clientOptions.timeout,
            strictSSL: this.clientOptions.strictSSL,
            heartbeat: options?.heartbeat,
            auth
        });

        this.ipObjectCache = cache ?? new IpObjectsCacher(options.maxIpCache);
    }

    private getWatcherAuthentication(
        watcherOptions: ICrowdSecHTTPMiddlewareOptions['watcher']
    ): IWatcherAuthentication | ITLSAuthentication {
        this.logger.debug('getWatcherAuthentication');
        if (Validate.implementsTKeys<ITLSAuthentication>(watcherOptions, ['key', 'ca', 'cert'])) {
            return {
                cert: watcherOptions.cert,
                key: watcherOptions.key,
                ca: watcherOptions.ca
            } as ITLSAuthentication;
        }
        if (Validate.implementsTKeys<IWatcherAuthentication>(watcherOptions, ['password', 'machineID'])) {
            return {
                machineID: watcherOptions.machineID,
                password: watcherOptions.password,
                autoRenew: watcherOptions.autoRenew ?? true
            } as IWatcherAuthentication;
        }

        throw new Error('bad client configuration');
    }

    public async start() {
        this.logger.info('start');

        await this.loadDefaultsScenarios(true);
        if (this.options.scenarios) {
            this.options.scenarios.forEach((scenario) =>
                this.addScenario(typeof scenario === 'string' ? scenario : this.initScenario(scenario))
            );
        } else {
            this.logger.debug(`add (${this.defaultScenarios.length}) default scenarios`);
            this.defaultScenarios.forEach((scenario) => this.addScenario(this.initScenario(scenario)));
        }

        if (this.scenarios?.length > 0) {
            this.logger.debug(`start to load (${this.scenarios.length}) scenarios`);
            await Promise.all(this.scenarios.map((s) => (s.loaded === false && s.load ? s.load() : Promise.resolve())));
        }

        this.logger.debug('login');
        await this.client.login();
    }

    public async loadDefaultsScenarios(allowFail = false) {
        this.logger.info('loadDefaultsScenarios');
        let defaultScenariosPackage: { scenarios: Array<new (options: any) => BaseScenario> };
        try {
            defaultScenariosPackage = await import(SCENARIOS_PACKAGE_NAME);
        } catch (e) {
            this.logger.error('fail to load defaultScenarios', e);
            if (allowFail) {
                return;
            }

            throw new Error(`fail to load "${SCENARIOS_PACKAGE_NAME}". You need to install ${SCENARIOS_PACKAGE_NAME} first`);
        }

        if (!defaultScenariosPackage.scenarios) {
            throw new Error('fail to correctly load default scenarios');
        }

        this.defaultScenarios = defaultScenariosPackage.scenarios;
    }

    private _addScenario(scenario: IScenario) {
        this.logger.debug('_addScenario', scenario.name);
        if (!this.client) {
            throw new Error('client need to be configured to register scenario');
        }
        this.scenarios.push(scenario);
        if (scenario.announceToLAPI) {
            this.client.scenarios.push(scenario.name);
        }
    }

    public addScenario(scenario: IScenario | string) {
        if (!scenario) {
            throw new Error('scenario is needed');
        }

        this.logger.debug('add scenario', typeof scenario === 'string' ? scenario : scenario.name);

        let currentScenario: IScenario;
        if (typeof scenario === 'string') {
            if (!this.defaultScenarios) {
                throw new Error(`defaultScenarios are not loaded . Did you call loadDefaultsScenarios() before ?`);
            }

            const defaultScenario = this.defaultScenarios.find((s) => s.name === scenario);
            if (!defaultScenario) {
                throw new Error(`no scenario found with name "${scenario}"`);
            }

            currentScenario = this.initScenario(defaultScenario);
        } else {
            currentScenario = scenario;
        }

        this._addScenario(currentScenario);
    }

    private initScenario(scenarioConstructor: IScenarioConstructor): IScenario {
        const scenarioOptions = this.options?.scenariosOptions;
        return new scenarioConstructor(scenarioOptions);
    }

    public async stop() {
        this.logger.info('stop');
        return this.client.stop();
    }

    public extractIp(req: IncomingMessage): string | undefined {
        const localDebug = this.logger.extend('extractIp');
        localDebug.debug('start extracting ip from request');

        const othersIpsFound: Array<IIpExtractionResult> = [];
        const ip = this.scenarios.reduce((currentIp: string | undefined, currentScenario) => {
            if (currentIp || !currentScenario.extractIp) {
                return currentIp;
            }

            const ipExtracted = currentScenario.extractIp(req);

            // confidence = 10 => we are sure of the ip
            if (ipExtracted?.confidence === MAX_CONFIDENCE) {
                return ipExtracted.ip;
            }

            if (ipExtracted) {
                othersIpsFound.push(ipExtracted);
            }

            return undefined;
        }, undefined);

        if (!ip && othersIpsFound.length > 0) {
            localDebug.debug('no ip found with max confidence, check with less confidence');
            return [...othersIpsFound].sort((a, b) => b.confidence - a.confidence)[0]?.ip;
        }
        localDebug.debug('ip found');
        return ip;
    }

    /**
     * Middleware function that processes incoming requests and checks for alerts based on IP address and request data.
     *
     * @param {string} ip - The IP address of the incoming request.
     * @param {IncomingMessage & { decision?: Decision<any> }} req - The incoming request object.
     */
    public middleware(ip: string, req: IncomingMessage & { decision?: Decision<any> }): void {
        const localDebug = this.logger.extend('watcherMiddleware');
        localDebug.debug('start');
        try {
            const currentAddress = this.ipObjectCache.getIpObjectWithCache(ip);
            localDebug.debug('watcherMiddleware receive request from ', currentAddress.addressMinusSuffix);
            localDebug.debug('start check');
            const alerts = this.scenarios
                .map((scenario) => {
                    const alerts = scenario.check?.(currentAddress, req);
                    if (!alerts) {
                        return undefined;
                    }

                    return Array.isArray(alerts) ? alerts : [alerts];
                })
                .flat()
                .filter((v) => !!v) as Array<APITypes.Alert>;

            localDebug.debug('end check');

            if (alerts.length === 0) {
                return;
            }

            localDebug.debug('start enrich');
            const enrichedAlerts = alerts
                .map((alert) => {
                    return this.scenarios.reduce((previousValue: APITypes.Alert | undefined, scenario: IScenario) => {
                        if (!scenario.enrich || !previousValue) {
                            return previousValue;
                        }

                        return scenario.enrich(previousValue, req);
                    }, alert);
                })
                .filter((v) => !!v) as Array<APITypes.Alert>;
            localDebug.debug('end enrich');

            if (enrichedAlerts.length === 0) {
                return;
            }

            this.logger.debug(`ip ${ip} triggers alerts on scenarios : ${enrichedAlerts.map(({ scenario }) => scenario).join(', ')}`);

            this.client.Alerts.pushAlerts(enrichedAlerts).catch((e) => console.error('fail to push alert', e));
        } finally {
            localDebug.debug('end');
        }
    }

    public getMiddleware(getIpFromRequest: getCurrentIpFn) {
        return (req: IncomingMessage) => {
            const ip = getIpFromRequest(req);

            this.middleware(ip, req);
        };
    }
}
