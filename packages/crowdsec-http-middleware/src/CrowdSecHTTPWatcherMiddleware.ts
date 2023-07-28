import { getCurrentIpFn, ICrowdSecHTTPMiddlewareOptions, ICrowdSecHTTPWatcherMiddlewareOptions } from './ICrowdSecHTTPMiddlewareOptions.js';
import Validate from './Validate.js';
import { APITypes, Decision, ICrowdSecClientOptions, ITLSAuthentication, IWatcherAuthentication, WatcherClient } from 'crowdsec-client';
import { createDebugger } from './utils.js';
import { IpObjectsCacher } from './IpObjectsCacher.js';
import { IncomingMessage } from 'http';
import { BaseScenario, IIpExtractionResult, IScenario, IScenarioConstructor, MAX_CONFIDENCE } from 'crowdsec-client-scenarios';

const SCENARIOS_PACKAGE_NAME = 'crowdsec-client-scenarios';

const debug = createDebugger('CrowdSecHTTPWatcherMiddleware');

/**
 * TODO
 *
 * only ip extraction was tested
 */

export class CrowdSecHTTPWatcherMiddleware {
    private readonly clientOptions: ICrowdSecClientOptions;
    public readonly client: WatcherClient;
    private scenarios: Array<IScenario> = [];
    private defaultScenarios: Array<IScenarioConstructor> = [];
    private options: ICrowdSecHTTPWatcherMiddlewareOptions;
    private ipObjectCache: IpObjectsCacher;

    constructor(options: ICrowdSecHTTPWatcherMiddlewareOptions, clientOptions: ICrowdSecClientOptions, cache?: IpObjectsCacher) {
        debug('construct');
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
        debug('getWatcherAuthentication');
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
        debug('start');

        await this.loadDefaultsScenarios(true);
        if (this.options.scenarios) {
            this.options.scenarios.forEach((scenario) =>
                this.addScenario(typeof scenario === 'string' ? scenario : this.initScenario(scenario))
            );
        } else {
            debug('add (%d) default scenarios', this.defaultScenarios.length);
            this.defaultScenarios.forEach((scenario) => this.addScenario(this.initScenario(scenario)));
        }

        if (this.scenarios?.length > 0) {
            debug('start to load %d scenarios', this.scenarios.length);
            await Promise.all(this.scenarios.map((s) => (s.loaded === false && s.load ? s.load() : Promise.resolve())));
        }

        debug('login');
        await this.client.login();
    }

    public async loadDefaultsScenarios(allowFail = false) {
        debug('loadDefaultsScenarios');
        let defaultScenariosPackage: { scenarios: Array<new (options: any) => BaseScenario> };
        try {
            defaultScenariosPackage = await import(SCENARIOS_PACKAGE_NAME);
        } catch (e) {
            debug('fail to load defaultScenarios : %o', e);
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
        debug('_addScenario(%s)', scenario.name);
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

        debug('add scenario "%s"', typeof scenario === 'string' ? scenario : scenario.name);

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
        debug('stop');
        return this.client.stop();
    }

    public extractIp(req: IncomingMessage): string | undefined {
        const localDebug = debug.extend('extractIp');
        localDebug('start extracting ip from request');

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
            localDebug('no ip found with max confidence, check with less confidence');
            return [...othersIpsFound].sort((a, b) => b.confidence - a.confidence)[0]?.ip;
        }
        localDebug('ip found');
        return ip;
    }

    public middleware(ip: string, req: IncomingMessage & { decision?: Decision<any> }) {
        const localDebug = debug.extend('watcherMiddleware');
        localDebug('start');
        try {
            const currentAddress = this.ipObjectCache.getIpObjectWithCache(ip);
            localDebug('watcherMiddleware receive request from %s', currentAddress.addressMinusSuffix);
            localDebug('start check');
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

            localDebug('end check');

            if (alerts.length === 0) {
                return;
            }

            localDebug('start enrich');
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
            localDebug('end enrich');

            if (enrichedAlerts.length === 0) {
                return;
            }

            this.client.Alerts.pushAlerts(enrichedAlerts)
                .then((res) => console.log(res))
                .catch((e) => console.error('fail to push alert', e));
        } finally {
            localDebug('end');
        }
    }

    public getMiddleware(getIpFromRequest: getCurrentIpFn) {
        return (req: IncomingMessage) => {
            const ip = getIpFromRequest(req);

            this.middleware(ip, req);
        };
    }
}
