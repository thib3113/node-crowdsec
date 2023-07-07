import { getCurrentIpFn, ICrowdSecHTTPMiddlewareOptions, ICrowdSecHTTPWatcherMiddlewareOptions } from './ICrowdSecHTTPMiddlewareOptions.js';
import Validate from './Validate.js';
import { APITypes, Decision, ICrowdSecClientOptions, ITLSAuthentication, IWatcherAuthentication, WatcherClient } from 'crowdsec-client';
import { createDebugger } from './utils.js';
import { IpObjectsCacher } from './IpObjectsCacher.js';
import { IncomingMessage, ServerResponse } from 'http';
import { BaseScenario, IScenario, IScenarioConstructor } from 'crowdsec-client-scenarios';

const SCENARIOS_PACKAGE_NAME = 'crowdsec-client-scenarios';

const debug = createDebugger('CrowdSecHTTPWatcherMiddleware');

/**
 * TODO
 *
 * only ip extraction was tested
 */

export class CrowdSecHTTPWatcherMiddleware {
    private readonly clientOptions: ICrowdSecClientOptions;
    private readonly watcher: WatcherClient;
    private scenarios: Array<IScenario> = [];
    private defaultScenarios: Array<IScenarioConstructor> = [];
    private options: ICrowdSecHTTPWatcherMiddlewareOptions;
    private ipObjectCache: IpObjectsCacher;

    constructor(options: ICrowdSecHTTPWatcherMiddlewareOptions, clientOptions: ICrowdSecClientOptions, cache?: IpObjectsCacher) {
        debug('construct');
        this.options = options;
        this.clientOptions = clientOptions;

        const auth = this.getWatcherAuthentication(options);

        this.watcher = new WatcherClient({
            url: this.clientOptions.url,
            userAgent: this.clientOptions.userAgent,
            timeout: this.clientOptions.timeout,
            strictSSL: this.clientOptions.strictSSL,
            heartbeat: options?.heartbeat,
            auth
        });

        this.ipObjectCache = cache || new IpObjectsCacher(options.maxIpCache);
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

        throw new Error('bad watcher configuration');
    }

    public async start() {
        debug('start');

        debug('login');
        await this.watcher.login();

        await this.loadDefaultsScenarios(true);
        if (!this.options.scenarios) {
            debug('add (%d) default scenarios', this.defaultScenarios.length);
            this.defaultScenarios.forEach((scenario) => this.addScenario(this.initScenario(scenario)));
        }

        if (this.scenarios?.length > 0) {
            debug('start to load %d scenarios', this.scenarios.length);
            await Promise.all(this.scenarios.map((s) => (s.loaded === false && s.load ? s.load() : Promise.resolve())));
        }
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
        if (!this.watcher) {
            throw new Error('watcher need to be configured to register scenario');
        }
        this.scenarios.push(scenario);
        this.watcher.scenarios.push(scenario.name);
    }

    public addScenario(scenario: IScenario | string) {
        if (!scenario) {
            throw new Error('scenario is needed');
        }

        debug('add scenario %s', typeof scenario === 'string' ? scenario : scenario.name);

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
        return this.watcher.stop();
    }

    public extractIp(req: IncomingMessage): string | undefined {
        return this.scenarios.reduce((currentIp: string | undefined, currentScenario) => {
            if (currentIp || !currentScenario.extractIp) {
                return currentIp;
            }

            return currentScenario.extractIp(req);
        }, undefined);
    }

    // TODO
    public middleware(ip: string, req: IncomingMessage & { decision?: Decision<any> }) {
        try {
            console.time('watcherMiddleware');
            let alert: APITypes.Alert | undefined;

            const currentAddress = this.ipObjectCache.getIpObjectWithCache(ip);
            debug('watcherMiddleware receive request from %s', currentAddress.addressMinusSuffix);
            this.scenarios.find((s) => (alert = s.check?.(currentAddress, req)));

            if (!alert) {
                return;
            }

            alert = this.scenarios.reduce((previousValue: APITypes.Alert | undefined, scenario: IScenario) => {
                if (!scenario.enrich || !previousValue) {
                    return previousValue;
                }

                return scenario.enrich(previousValue);
            }, alert);

            if (!alert) {
                return;
            }

            this.watcher.Alerts.pushAlerts([alert]).catch((e) => console.error('fail to push alert', e));
        } finally {
            console.timeEnd('watcherMiddleware');
        }
    }

    public getMiddleware(getIpFromRequest: getCurrentIpFn) {
        return (req: IncomingMessage, res: ServerResponse) => {
            const ip = getIpFromRequest(req);

            this.middleware(ip, req);
        };
    }
}
