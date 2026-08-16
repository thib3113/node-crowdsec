import { describe, expect, it } from 'vitest';
import { IncomingMessage } from 'http';
import { XForwardedForChecker } from '../../src/scenarios/XForwardedFor/XForwardedForChecker.js';
import { getIpObject } from '../../src/utils.js';
import { Address4, Address6 } from 'ip-address';

const getRequest = (forwardedFor: string, remoteAddress = '1.1.1.1'): IncomingMessage =>
    ({
        socket: {
            remoteAddress
        },
        headers: {
            'X-Forwarded-For': forwardedFor
        }
    } as unknown as IncomingMessage);

describe('getIpObject', () => {
    it.each<[string, boolean]>([
        ['::ffff:10.0.0.5', true],
        ['10.0.0.5', true],
        ['::1', false],
        ['2001:db8::1', false]
    ])('%s', (ip, isIpv4) => {
        const object = getIpObject(ip);
        expect(object).toBeInstanceOf(isIpv4 ? Address4 : Address6);
    });

    it('should parse an ipv4-mapped ipv6 as a valid ipv4', () => {
        const object = getIpObject('::ffff:10.0.0.5');
        expect(object.isInSubnet(new Address4('10.0.0.0/8'))).toBe(true);
    });
});

describe('XForwardedForChecker', () => {
    describe('extractIps', () => {
        const scenario = new XForwardedForChecker({
            'x-forwarded-for': {
                trustedProxies: ['1.1.1.1', '2.2.2.2', '10.0.0.0/8']
            }
        });

        it.each<[string, string]>([
            //normal
            ['9.9.9.9, 2.2.2.2, 1.1.1.1', '9.9.9.9'],
            //with invalid ip
            ['<<<<, 9.9.9.9, 2.2.2.2, 1.1.1.1', '9.9.9.9'],
            //with others malveillant ips
            ['9.9.9.8, 9.9.9.9, 2.2.2.2, 1.1.1.1', '9.9.9.9'],
            //with ipv6
            ['47e5:1cdd:b9cb:aeb2:a670:c14f:17ea:7b74, 2.2.2.2, 1.1.1.1', '47e5:1cdd:b9cb:aeb2:a670:c14f:17ea:7b74'],
            //with bad configuration ( trusted proxy return invalid information )
            ['<<<<, 2.2.2.2, 1.1.1.1', '2.2.2.2']
        ])('XForwardedFor "%s" need to return ip %s', (header, ip) => {
            expect(scenario.extractIp(getRequest(header))).toStrictEqual(
                expect.objectContaining({
                    ip
                })
            );
        });
    });

    describe('ipv4-mapped ipv6 in trusted proxies', () => {
        const scenario = new XForwardedForChecker({
            'x-forwarded-for': {
                trustedProxies: ['10.0.0.0/8']
            }
        });

        it('extract the client ip behind a dual-stack trusted proxy', () => {
            const result = scenario.extractIp(getRequest('9.9.9.9', '::ffff:10.0.0.5'));

            expect(result).toStrictEqual(
                expect.objectContaining({
                    ip: '9.9.9.9'
                })
            );
        });

        it('do not alert on untrusted proxy when the socket is a trusted ipv4-mapped ipv6', () => {
            const alerts = scenario.check(getIpObject('9.9.9.9'), getRequest('9.9.9.9', '::ffff:10.0.0.5'));

            expect(alerts).toStrictEqual([]);
        });

        it('alert on untrusted proxy when the socket is not in a trusted ipv4 CIDR', () => {
            const scenarioUntrusted = new XForwardedForChecker({
                'x-forwarded-for': {
                    trustedProxies: ['10.0.0.0/8'],
                    alertOnNotTrustedIps: true
                }
            });
            const alerts = scenarioUntrusted.check(getIpObject('9.9.9.9'), getRequest('9.9.9.9', '::ffff:192.0.2.1'));

            expect(alerts).toHaveLength(1);
            expect(alerts[0]).toEqual(
                expect.objectContaining({
                    scenario: 'thib3113/x-forwarded-for/untrusted-proxy'
                })
            );
        });
    });
});
