import { describe, it, afterEach, beforeEach, expect, vi } from 'vitest';

import type { DeleteAlertsQuery, SearchAlertsQuery } from '../../src/types/index.js';
import type { Alerts } from '../../src/index.js';
import { LapiCapability } from '../../src/Capabilities.js';

vi.mock('../../src/BaseSubObject.js', () => ({
    BaseSubObject: class {
        requireCapability = vi.fn();
    }
}));

describe('DecisionsWatcher', () => {
    const httpDeleteMock = vi.fn();
    const httpPostMock = vi.fn();
    const httpGetMock = vi.fn();
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
        const searchOptions: SearchAlertsQuery = {
            ip: '1.2.3.4',
            contains: false
        };

        expect(await alerts.search(searchOptions)).toBe('test');

        expect(httpGetMock).toHaveBeenCalledWith('/v1/alerts', { params: searchOptions });
    });

    it('should call delete with options', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));
        const deleteOptions: DeleteAlertsQuery = {
            ip: '1.2.3.4'
        };

        expect(await alerts.delete(deleteOptions)).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/alerts', { params: { ...deleteOptions, contains: false } });
        // The implicit contains=false must be gated like an explicit one.
        // @ts-ignore
        expect(alerts.requireCapability).toHaveBeenCalledWith(LapiCapability.containsFilter);
    });

    it('should keep an explicit contains value on an ip delete', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        await alerts.delete({ ip: '1.2.3.4', contains: true });

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/alerts', { params: { ip: '1.2.3.4', contains: true } });
    });

    it('should forward duration and extended delete filters', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));
        const deleteOptions: DeleteAlertsQuery = {
            since: '24h',
            until: '1h',
            decision_type: 'ban'
        };

        expect(await alerts.delete(deleteOptions)).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/alerts', { params: deleteOptions });
    });

    it('should require the origin capability when deleting by origin', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        await alerts.delete({ origin: 'cscli' });

        expect((alerts as unknown as { requireCapability: ReturnType<typeof vi.fn> }).requireCapability).toHaveBeenCalledWith(
            'alertOriginFilter'
        );
    });

    it('should call delete with id', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await alerts.deleteById('123')).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/alerts/123');
    });

    it('should encode the id segment', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        await alerts.deleteById('1/../watchers/self');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/alerts/1%2F..%2Fwatchers%2Fself');
    });
});
