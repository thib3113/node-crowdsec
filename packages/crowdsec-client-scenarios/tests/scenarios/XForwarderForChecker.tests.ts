import { describe, expect, it } from '@jest/globals';
import { IncomingMessage } from 'http';
import { XForwardedForChecker } from '../../src/scenarios/XForwardedFor/XForwardedForChecker.js';

const getRequest = (forwardedFor: string): IncomingMessage =>
    ({
        socket: {
            remoteAddress: '1.1.1.1'
        },
        headers: {
            'X-Forwarded-For': forwardedFor
        }
    } as unknown as IncomingMessage);

describe('XForwardedForChecker', () => {
    describe('extractIps', () => {
        const scenario = new XForwardedForChecker({
            'x-forwarded-for': {
                trustedProxies: ['1.1.1.1', '2.2.2.2']
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
});
