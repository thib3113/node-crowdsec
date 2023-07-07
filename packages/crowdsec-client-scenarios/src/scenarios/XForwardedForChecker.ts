import { BaseScenario } from '../baseScenarios/index.js';
import { APITypes } from 'crowdsec-client';
import { AddressObject, createDebugger } from '../utils.js';
import { IScenarioOptions } from './IScenarioOptions.js';
import { IncomingMessage } from 'http';
import { IncomingHttpHeaders } from 'http2';

declare module './IScenarioOptions.js' {
    interface IScenarioOptions {
        'x-forwarded-for': {
            /**
             * ips/cidr of allowed reverse proxies
             */
            trustedProxies?: Array<string>;
            alertOnInvalidIps?: boolean;
            alertOnNotTrustedIps?: boolean;
        };
    }
}

const debug = createDebugger('XForwardedForChecker');
export class XForwardedForChecker extends BaseScenario {
    static scenarioName: 'x-forwarded-for';
    private reverseProxiesRange: Array<AddressObject>;
    constructor(options: IScenarioOptions) {
        debug('construct');
        super(options);

        const currentOptions = options['x-forwarded-for'];
        this.reverseProxiesRange = (currentOptions.trustedProxies || []).map((cidr) => this.getAddressObjectWithCache(cidr));
    }

    check(ip: AddressObject, req: IncomingMessage): APITypes.Alert | undefined {
        return super.check(ip, req);
    }

    private extractIpsFromHeader(xForwardedHeaders: string | Array<string>): Array<AddressObject | null> {
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
                    try {
                        return this.getAddressObjectWithCache(header);
                    } catch (e) {
                        debug(`fail to read ip "${header}"`);
                        return null;
                    }
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

    private extractRealIp(req: IncomingMessage): { ip: string | undefined | null; lastEvaluated: string | undefined } {
        const localDebug = debug.extend('extractRealIp');
        localDebug('start');
        const remoteAddress = this.getAddressObjectWithCache(req.socket.remoteAddress);
        /**
         * undefined => no ip found
         * null => invalid ip found before sending valid ip
         * string => ip found
         */
        let lastEvaluatedIp = remoteAddress.addressMinusSuffix;
        const realIp = [remoteAddress, ...this.extractIpsFromHeader(this.getXForwardedForHeader(req.headers))].reduce(
            (previousValue: AddressObject | undefined | null, currentValue) => {
                //reverse proxy already found
                if (previousValue || previousValue === null) {
                    return previousValue;
                }

                localDebug('test if %o is a reverse proxy', currentValue ? currentValue.address : currentValue);
                if (
                    currentValue &&
                    this.reverseProxiesRange.some((address) => {
                        const res = currentValue.isInSubnet(address);

                        localDebug(`%s is in subnet %s ? %o`, currentValue.address, address.address, res);

                        return res;
                    })
                ) {
                    lastEvaluatedIp = currentValue.addressMinusSuffix;
                    localDebug('%s is a reverse proxy', currentValue.addressMinusSuffix);
                    return undefined;
                }

                localDebug('%o is not a reverse proxy', currentValue ? currentValue.address : currentValue);
                return currentValue;
            },
            undefined
        );

        return {
            ip: realIp ? realIp.addressMinusSuffix : realIp,
            lastEvaluated: lastEvaluatedIp
        };
    }

    public extractIp = (req: IncomingMessage) => {
        const localDebug = debug.extend('extractIp');
        localDebug('start');

        const realIp = this.extractRealIp(req);

        if (!realIp?.ip) {
            debug('fail to extract ip');
            return undefined;
        }

        debug('found ip %o from %s', realIp.ip, realIp.lastEvaluated);
        return realIp.ip;
    };
}
