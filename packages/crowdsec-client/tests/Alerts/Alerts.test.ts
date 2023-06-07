import { jest, describe, it, afterEach, beforeEach, expect } from '@jest/globals';

import type { Alerts as AlertsTypes } from '../../src/types/index.js';
import type { Alerts } from '../../src/index.js';

jest.unstable_mockModule('../../src/BaseSubObject.js', () => ({ BaseSubObject: jest.fn() }));

describe('DecisionsWatcher', () => {
    const httpDeleteMock = jest.fn();
    const httpPostMock = jest.fn();
    const httpGetMock = jest.fn();
    let alerts: Alerts;
    beforeEach(async () => {
        const res = await import('../../src/Alerts/Alerts.js');
        // @ts-ignore
        alerts = new res.Alerts();
        // @ts-ignore
        alerts.http = { get: httpGetMock, post: httpPostMock, delete: httpDeleteMock };
    });
    afterEach(() => {
        httpDeleteMock.mockReset();
    });
    it('should push alerts', async () => {
        httpPostMock.mockImplementationOnce(() => ({ data: 'test' }));

        const alertsBody = [
            {
                capacity: 0,
                created_at: '2023-06-04T08:35:48Z',
                decisions: [
                    {
                        duration: '24h',
                        origin: 'cscli',
                        scenario: "manual 'captcha' from 'test'",
                        scope: 'Ip',
                        type: 'captcha',
                        value: '1.2.3.4'
                    }
                ],
                events: [],
                events_count: 1,
                labels: undefined,
                leakspeed: '0',
                message: "manual 'captcha' from 'test'",
                scenario: "manual 'captcha' from 'test'",
                scenario_hash: '',
                scenario_version: '',
                simulated: false,
                source: { ip: '1.2.3.4', scope: 'Ip', value: '1.2.3.4' },
                start_at: '2023-06-04T08:35:48Z',
                stop_at: '2023-06-04T08:35:48Z'
            }
        ];

        expect(await alerts.pushAlerts(alertsBody)).toBe('test');

        expect(httpPostMock).toHaveBeenCalledWith('/v1/alerts', alertsBody);
    });

    it('should call get with id', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await alerts.getById('123')).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/alerts/123');
    });

    it('should search', async () => {
        httpGetMock.mockImplementationOnce(() => ({ data: 'test' }));
        const deleteOptions: AlertsTypes.SearchAlerts.RequestQuery = {
            ip: '1.2.3.4'
        };

        expect(await alerts.search(deleteOptions)).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/alerts', { params: deleteOptions });
    });

    it('should call delete with options', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));
        const deleteOptions: AlertsTypes.DeleteAlerts.RequestQuery = {
            ip: '1.2.3.4'
        };

        expect(await alerts.delete(deleteOptions)).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/alerts', { data: deleteOptions });
    });

    it('should call delete with id', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await alerts.deleteById('123')).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/alerts/123');
    });
});
