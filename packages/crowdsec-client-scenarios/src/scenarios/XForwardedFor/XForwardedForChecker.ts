import { BaseScenario, IIpExtractionResult, MAX_CONFIDENCE } from '../../baseScenarios/index.js';
import { APITypes } from 'crowdsec-client';
import { AddressObject, createDebugger } from '../../utils.js';
import { IScenarioOptions } from '../IScenarioOptions.js';
import { IncomingMessage } from 'http';
import { IncomingHttpHeaders } from 'http2';
import { CheckerScenario } from '../../baseScenarios/CheckerScenario.js';

export interface IXForwardedForOptions {
    /**
     * ips/cidr of allowed reverse proxies
     */
    trustedProxies?: Array<string>;
    alertOnNotTrustedIps?: boolean;
}

declare module '../IScenarioOptions.js' {
    interface IScenarioOptions {
        'x-forwarded-for': IXForwardedForOptions;
    }
}

export interface IExtractedIP {
    ip: string;
    address: AddressObject;
    trustedProxy?: boolean;
    valid?: boolean;
}

const debug = createDebugger('XForwardedForChecker');
export class XForwardedForChecker extends CheckerScenario {
    static readonly scenarioName = 'thib3113/x-forwarded-for';
    static readonly scenarioVersion = '0.0.1';

    private reverseProxiesRange: Array<AddressObject>;
    private readonly currentOptions: IXForwardedForOptions;

    constructor(options?: IScenarioOptions) {
        debug('construct');
        super(options);

        const currentOptions = options?.['x-forwarded-for'];
        this.currentOptions = {
            alertOnNotTrustedIps: true,
            ...currentOptions
        };
        this.reverseProxiesRange = (currentOptions?.trustedProxies || []).map((cidr) => this.getAddressObjectWithCache(cidr));
    }

    private generateAlert(
        alert: Omit<APITypes.Alert, 'scenario_version' | 'scenario_hash' | 'capacity' | 'leakspeed' | 'simulated' | 'events' | 'source'> &
            Partial<Pick<APITypes.Alert, 'events' | 'capacity' | 'leakspeed' | 'simulated' | 'source'>>,
        ip: string
    ): APITypes.Alert {
        return {
            capacity: 0,
            simulated: false,
            events: [],
            leakspeed: '0s',
            ...alert,
            remediation: true,
            source: {
                ...alert.source,
                scope: 'ip',
                ip,
                value: ip
            },
            scenario_hash: '',
            scenario_version: XForwardedForChecker.scenarioVersion
        };
    }

    protected _check(ip: AddressObject, req: IncomingMessage): Array<APITypes.Alert> | APITypes.Alert | undefined {
        const localDebug = debug.extend(`check(${ip.address})`);
        localDebug('start()');

        const { alertOnNotTrustedIps } = this.currentOptions;

        const date = new Date().toISOString();
        const alerts: Array<APITypes.Alert> = [];
        const ipResult = this.extractIps(req);

        const ipStr = ip.addressMinusSuffix || '';
        if (ipResult.findIndex((i) => !i.trustedProxy) < ipResult.length) {
            localDebug('untrusted "proxy" pass header, send alert ? %o', alertOnNotTrustedIps);
            if (alertOnNotTrustedIps) {
                //create alert
                const scenarioName = `${XForwardedForChecker.scenarioName}/untrusted-proxy`;
                //create alert
                alerts.push(
                    this.generateAlert(
                        {
                            scenario: scenarioName,
                            created_at: date,
                            events: [
                                {
                                    meta: [
                                        {
                                            key: 'source_ip',
                                            value: ipStr
                                        },
                                        {
                                            key: 'timestamp',
                                            value: date
                                        }
                                    ],
                                    timestamp: date
                                }
                            ],
                            events_count: 1,
                            message: `Ip ${ipStr} performed '${scenarioName}' (1 event) at ${date}`,
                            start_at: date,
                            stop_at: date
                        },
                        ipStr
                    )
                );
            }
        }

        return alerts;
    }

    private extractIpsFromHeader(xForwardedHeaders: string | Array<string>): Array<IExtractedIP> {
        return (
            (Array.isArray(xForwardedHeaders) ? xForwardedHeaders : [xForwardedHeaders])
                //flat multiple  headers
                .flat()
                //split x-forwarded-for
                .map((header) => (header || '').replace(/\s*/g, '').split(','))
                //flat all ips
                .flat()
                //try to parse ips
                .map((header) => {
                    const returnIP = {
                        ip: header
                    } as IExtractedIP;
                    try {
                        returnIP.address = this.getAddressObjectWithCache(header);
                    } catch (e) {
                        debug(`fail to read ip "${header}"`);
                    }

                    return returnIP;
                })
                .reverse()
        );
    }

    private getXForwardedForHeader(headers: IncomingHttpHeaders): Array<string> {
        const localDebug = debug.extend('getXForwardedForHeader');
        localDebug('start');

        const headerName = 'X-Forwarded-For'.toLowerCase();

        const headersFound = Object.entries(headers)
            .filter(([key, value]) => key.toLowerCase() === headerName && value)
            .map(([_, value]) => value)
            .flat() as Array<string>;

        debug('find %d header matching %s', headersFound.length, headerName);
        return headersFound;
    }

    private extractIps(req: IncomingMessage): Array<IExtractedIP> {
        const localDebug = debug.extend('extractIps');
        localDebug('start');

        const { remoteAddress } = req.socket;
        const remoteAddressIPResult = {
            ip: remoteAddress,
            address: this.getAddressObjectWithCache(remoteAddress),
            valid: true
        } as IExtractedIP;

        let firstUntrustedIpFound = false;

        return [remoteAddressIPResult, ...this.extractIpsFromHeader(this.getXForwardedForHeader(req.headers))].map((ipResult) => {
            localDebug('test if %o is a reverse proxy', ipResult.ip);

            ipResult.valid = true;
            ipResult.trustedProxy = false;

            if (!ipResult.address) {
                ipResult.valid = false;
                return ipResult;
            }

            if (
                !firstUntrustedIpFound &&
                this.reverseProxiesRange.some((address) => {
                    const res = ipResult.address.isInSubnet(address);

                    localDebug(`%o is in subnet %o ? %o`, ipResult.ip, address.address, res);

                    return res;
                })
            ) {
                localDebug('%o is a reverse proxy', ipResult.address.addressMinusSuffix);
                return {
                    ...ipResult,
                    trustedProxy: true
                };
            }

            firstUntrustedIpFound = true;

            localDebug('%o is not a reverse proxy', ipResult.ip);
            return ipResult;
        }) as Array<IExtractedIP>;
    }

    public extractIp = (req: IncomingMessage): IIpExtractionResult | undefined => {
        const localDebug = debug.extend('extractIp');
        localDebug('start');

        const ips = this.extractIps(req);

        let lastProxy: IExtractedIP | undefined;
        const lastIp: IExtractedIP | undefined = ips.find((value, index, obj) => {
            if (value.trustedProxy) {
                return false;
            }

            lastProxy = obj[index - 1];
            return !value?.trustedProxy;
        });

        if (!lastIp || !lastIp.valid) {
            debug('fail to extract ip');
            const previousIp = lastProxy;
            if (previousIp && previousIp.valid && previousIp.trustedProxy) {
                return {
                    confidence: 1,
                    ip: previousIp.ip
                };
            }

            return undefined;
        }

        debug('found ip %o from %s', lastIp.ip, ips[0].ip);
        return {
            ip: lastIp.ip,
            confidence: MAX_CONFIDENCE
        };
    };
}
