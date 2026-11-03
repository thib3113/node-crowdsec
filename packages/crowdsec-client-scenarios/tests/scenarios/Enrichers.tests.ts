import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOpen } = vi.hoisted(() => ({ mockOpen: vi.fn() }));

vi.mock('fs', () => ({ existsSync: () => true }));
vi.mock('maxmind', () => ({ default: { open: mockOpen } }));

import { AllowListEnricher } from '../../src/scenarios/AllowList/AllowListEnricher.js';
import { HTTPEnricher } from '../../src/scenarios/HTTPEnricher/HTTPEnricher.js';
import { MaxMindEnricher } from '../../src/scenarios/MaxMind/MaxMindEnricher.js';

describe('AllowListEnricher', () => {
    it('honours a custom list instead of the defaults', () => {
        const enricher = new AllowListEnricher({ 'allow-list': { allowed: ['203.0.113.0/24'] } });

        expect(enricher.enrich({ source: { ip: '203.0.113.5' }, events: [], meta: [] } as any)).toBeUndefined();
        // 10.0.0.0/8 is a default entry, but the custom list replaces defaults.
        const other = { source: { ip: '10.1.2.3' }, events: [], meta: [] } as any;
        expect(enricher.enrich(other)).toBe(other);
    });
});

describe('HTTPEnricher', () => {
    it('keeps the alert when the request URL is malformed', () => {
        const enricher = new HTTPEnricher();
        const alert = { events: [], meta: [] } as any;
        const req = { url: 'http://[::1', headers: {}, method: 'GET' } as any;

        expect(() => enricher.enrich(alert, req)).not.toThrow();
        expect(enricher.enrich(alert, req)).toBe(alert);
    });
});

describe('MaxMindEnricher', () => {
    beforeEach(() => {
        mockOpen.mockReset();
    });

    it('passes OpenOpts to maxmind and marks the enricher as loaded', async () => {
        mockOpen.mockResolvedValue({
            metadata: { databaseType: 'GeoLite2-City', languages: [], buildEpoch: 0 },
            getWithPrefixLength: () => [null, 0]
        });
        const enricher = new MaxMindEnricher({
            maxmind: { paths: { city: 'fake.mmdb' }, watchForUpdates: true },
            maxIpCache: 10
        });

        await enricher.load();

        expect(enricher.loaded).toBe(true);
        expect(mockOpen).toHaveBeenCalledWith('fake.mmdb', { watchForUpdates: true, cache: { max: 10 } });
    });
});
