import { jest, describe, it, afterEach, beforeEach, expect } from '@jest/globals';

import type { DecisionsBouncer } from '../../src/Decisions/DecisionsBouncer.js';

const mockDebugFn = jest.fn();
const mockDebug = jest.fn().mockReturnValue(() => {
    const debug = jest.fn;
    // @ts-ignore
    debug.extend = () => mockDebugFn;
});
const mockParseExpiration = jest.fn().mockReturnValue(new Date('2023-06-01T17:41:26.499Z'));
const mockForceArray = jest.fn().mockImplementation((p) => (Array.isArray(p) ? p : [p]));
const mockCreateDebugger = jest.fn().mockImplementation(() => mockDebug);
jest.unstable_mockModule('../../src/utils.js', () => ({
    parseExpiration: mockParseExpiration,
    createDebugger: mockCreateDebugger,
    forceArray: mockForceArray
}));
jest.unstable_mockModule('../../src/BaseSubObject.js', () => ({ BaseSubObject: jest.fn() }));

describe('DecisionsBouncer', () => {
    const httpGetMock = jest.fn();
    let bouncer: DecisionsBouncer;
    beforeEach(async () => {
        const res = await import('../../src/Decisions/DecisionsBouncer.js');
        // @ts-ignore
        bouncer = new res.DecisionsBouncer();
        // @ts-ignore
        bouncer.http = { get: httpGetMock };
    });
    afterEach(() => {
        httpGetMock.mockReset();
    });

    describe('search', () => {
        it('should search with full options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.search({
                    scope: 'ip',
                    value: '1.2.3.4',
                    type: 'ban',
                    ip: '1.2.3.4',
                    range: '1.2.3.4/32',
                    contains: true,
                    origins: 'cscli, crowdsec',
                    scenarios_containing: 'test1, test2',
                    scenarios_not_containing: 'test1, test2'
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: 'ip',
                    value: '1.2.3.4',
                    type: 'ban',
                    ip: '1.2.3.4',
                    range: '1.2.3.4/32',
                    contains: true,
                    origins: 'cscli, crowdsec',
                    scenarios_containing: 'test1, test2',
                    scenarios_not_containing: 'test1, test2'
                }
            });
        });
        it('should search with no options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(await bouncer.search()).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {}
            });
        });
        it('should search with other options', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.search({
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: '',
                    scenarios_containing: '',
                    scenarios_not_containing: ''
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: undefined,
                    scenarios_containing: undefined,
                    scenarios_not_containing: undefined
                }
            });
        });
        it('should search with arrays', async () => {
            httpGetMock.mockImplementationOnce(() => ({ data: [{ id: 'test' }] }));

            expect(
                await bouncer.search({
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: ['1', '2', '3'],
                    scenarios_containing: ['1', '2', '3'],
                    scenarios_not_containing: ['1', '2', '3']
                })
            ).toStrictEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test'
                    })
                ])
            );

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: '1,2,3',
                    scenarios_containing: '1,2,3',
                    scenarios_not_containing: '1,2,3'
                }
            });
        });
        it('should return nothing', async () => {
            httpGetMock.mockImplementationOnce(() => ({}));

            expect(
                await bouncer.search({
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: ['1', '2', '3'],
                    scenarios_containing: ['1', '2', '3'],
                    scenarios_not_containing: ['1', '2', '3']
                })
            ).toStrictEqual([]);

            expect(httpGetMock).toHaveBeenCalledWith('/v1/decisions', {
                params: {
                    scope: '',
                    value: '',
                    type: '',
                    ip: '',
                    range: '',
                    contains: false,
                    origins: '1,2,3',
                    scenarios_containing: '1,2,3',
                    scenarios_not_containing: '1,2,3'
                }
            });
        });
    });
});
