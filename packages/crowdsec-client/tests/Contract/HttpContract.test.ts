import http from 'node:http';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Alerts } from '../../src/Alerts/Alerts.js';
import { DecisionsWatcher } from '../../src/Decisions/DecisionsWatcher.js';
import { Allowlists } from '../../src/Allowlists/Allowlists.js';

interface RecordedRequest {
    method?: string;
    url: string;
    body: string;
}

let server: http.Server;
let requests: RecordedRequest[];
let baseURL: string;

function responseFor(request: RecordedRequest): unknown {
    if (request.url.startsWith('/v1/alerts/')) {
        return {
            id: 123,
            scenario: 'crowdsecurity/ssh-bf',
            scenario_hash: '',
            scenario_version: '',
            message: 'test',
            events_count: 1,
            start_at: '2026-01-01T00:00:00Z',
            stop_at: '2026-01-01T00:00:00Z',
            capacity: 0,
            leakspeed: '0',
            simulated: false,
            events: [],
            source: { scope: 'Ip', value: '1.2.3.4' }
        };
    }

    if (request.url === '/v1/allowlists/check') {
        return { results: [{ target: '1.2.3.4', allowlists: ['test'] }] };
    }

    if (request.url.startsWith('/v1/allowlists/check/')) {
        return { allowlisted: true, reason: 'test' };
    }

    if (request.url.startsWith('/v1/allowlists/')) {
        return { name: 'test', items: [] };
    }

    if (request.url.startsWith('/v1/allowlists')) {
        return [{ name: 'test', items: [] }];
    }

    return { nbDeleted: '1' };
}

beforeEach(async () => {
    requests = [];

    server = http.createServer((request, response) => {
        let body = '';
        request.on('data', (chunk: Buffer) => {
            body += chunk.toString();
        });
        request.on('end', () => {
            const recorded = {
                method: request.method,
                url: request.url ?? '',
                body
            };
            requests.push(recorded);
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify(responseFor(recorded)));
        });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('failed to bind test server');
    }
    baseURL = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

function httpClient() {
    return axios.create({ baseURL });
}

function parsedUrl(request: RecordedRequest): URL {
    return new URL(request.url, baseURL);
}

describe('HTTP contract', () => {
    it('sends alert delete filters as query parameters, not a body', async () => {
        const alerts = new Alerts({ httpClient: httpClient() });

        await alerts.delete({ ip: '1.2.3.4', type: 'ban' });

        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('DELETE');
        expect(parsedUrl(requests[0]).pathname).toBe('/v1/alerts');
        expect(parsedUrl(requests[0]).searchParams.get('ip')).toBe('1.2.3.4');
        expect(parsedUrl(requests[0]).searchParams.get('type')).toBe('ban');
        expect(requests[0].body).toBe('');
    });

    it('sends decision delete filters as query parameters, not a body', async () => {
        const decisions = new DecisionsWatcher({ httpClient: httpClient() });

        await decisions.delete({ ip: '1.2.3.4', type: 'ban' });

        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('DELETE');
        expect(parsedUrl(requests[0]).pathname).toBe('/v1/decisions');
        expect(parsedUrl(requests[0]).searchParams.get('ip')).toBe('1.2.3.4');
        expect(parsedUrl(requests[0]).searchParams.get('type')).toBe('ban');
        expect(requests[0].body).toBe('');
    });

    it('returns a single alert from getById', async () => {
        const alerts = new Alerts({ httpClient: httpClient() });

        const alert = await alerts.getById('123');

        expect(requests[0].method).toBe('GET');
        expect(requests[0].url).toBe('/v1/alerts/123');
        expect(alert.id).toBe(123);
        expect(alert.scenario).toBe('crowdsecurity/ssh-bf');
    });

    it('lists allowlists with content by default', async () => {
        const allowlists = new Allowlists({ httpClient: httpClient() });

        await allowlists.list();

        expect(requests[0].method).toBe('GET');
        expect(parsedUrl(requests[0]).pathname).toBe('/v1/allowlists');
        expect(parsedUrl(requests[0]).searchParams.get('with_content')).toBe('true');
    });

    it('lists allowlists without content on demand', async () => {
        const allowlists = new Allowlists({ httpClient: httpClient() });

        await allowlists.list(false);

        expect(parsedUrl(requests[0]).searchParams.get('with_content')).toBe('false');
    });

    it('gets an allowlist with an encoded name', async () => {
        const allowlists = new Allowlists({ httpClient: httpClient() });

        await allowlists.get('list with spaces', true);

        expect(requests[0].method).toBe('GET');
        expect(requests[0].url).toBe('/v1/allowlists/list%20with%20spaces?with_content=true');
    });

    it('checks a value with an encoded slash', async () => {
        const allowlists = new Allowlists({ httpClient: httpClient() });

        const result = await allowlists.check('10.0.0.0/8');

        expect(requests[0].method).toBe('GET');
        expect(requests[0].url).toBe('/v1/allowlists/check/10.0.0.0%2F8');
        expect(result.allowlisted).toBe(true);
    });

    it('bulk checks values with a JSON body', async () => {
        const allowlists = new Allowlists({ httpClient: httpClient() });

        const result = await allowlists.bulkCheck(['1.2.3.4', '5.6.7.8']);

        expect(requests[0].method).toBe('POST');
        expect(requests[0].url).toBe('/v1/allowlists/check');
        expect(JSON.parse(requests[0].body)).toEqual({ targets: ['1.2.3.4', '5.6.7.8'] });
        expect(result.results).toHaveLength(1);
    });
});
