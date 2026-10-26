import { describe, expect, it } from 'vitest';
import { BouncerClient, WatcherClient } from '../../src/index.js';

const live = process.env.CROWDSEC_LIVE === '1';
const url = process.env.CROWDSEC_URL;
const apiKey = process.env.CROWDSEC_API_KEY;
const machineId = process.env.CROWDSEC_MACHINE_ID;
const password = process.env.CROWDSEC_PASSWORD;
const strictSSL = process.env.CROWDSEC_STRICT_SSL !== 'false';

describe.skipIf(!live)('live CrowdSec API', () => {
    it.skipIf(!url || !apiKey)(
        'authenticates a bouncer and reads decisions',
        async () => {
            const client = new BouncerClient({
                url: url!,
                auth: { apiKey: apiKey! },
                strictSSL
            });

            try {
                await client.login();
                const decisions = await client.Decisions.search({});
                expect(Array.isArray(decisions)).toBe(true);
            } finally {
                await client.stop();
            }
        },
        30000
    );

    it.skipIf(!url || !machineId || !password)(
        'authenticates a watcher and reads alerts and allowlists',
        async () => {
            const client = new WatcherClient({
                url: url!,
                auth: {
                    machineID: machineId!,
                    password: password!,
                    autoRenew: false
                },
                strictSSL,
                heartbeat: false
            });

            try {
                await client.login();
                const alerts = await client.Alerts.search({ limit: 1 });
                const allowlists = await client.Allowlists.list();
                expect(Array.isArray(alerts)).toBe(true);
                expect(Array.isArray(allowlists)).toBe(true);
            } finally {
                await client.stop();
            }
        },
        30000
    );
});
