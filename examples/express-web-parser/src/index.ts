import * as dotenv from 'dotenv';
import { BouncerClient, Decision, WatcherClient } from 'crowdsec-client';
import express from 'express';
import { badUserAgents } from './badUserAgents.js';

dotenv.config({
    path: '../../.env'
});

// create main function to deal with async/await
const main = async () => {
    let decisions: Array<Decision> = [];

    if (!process.env.CROWDSEC_URL) {
        throw new Error('need process.env.CROWDSEC_URL');
    }

    //create object and login
    const watcherClient = new WatcherClient({
        url: process.env.CROWDSEC_URL,
        auth: {
            machineID: process.env.CROWDSEC_MACHINE_ID || '',
            password: process.env.CROWDSEC_PASSWORD || ''
        },
        strictSSL: false
    });
    await watcherClient.login();

    //now start the express server
    const app = express();
    const port = 3000;

    app.use((req, res, next) => {
        console.log(`receive connection from ${req.socket.remoteAddress}`);
        checkBadUserAgent(req, watcherClient);
        next();
    });

    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    app.listen(port, '127.0.0.1', () => {
        console.log(`Example app listening on port ${port}`);
    });
};

const checkBadUserAgent = (req: express.Request, watcher: WatcherClient) => {
    const fakeSource = '1.2.3.4';
    const scenarioName = 'expressjs/bad-user-agent';

    const currentUA = req.headers['user-agent'] ?? '';

    console.log(`checking user-agent : "${currentUA}"`);

    let badUserAgent: string | undefined;
    if ((badUserAgent = badUserAgents.find((ua) => currentUA.includes(ua)))) {
        console.log('push alert because of bad user-agent');
        // push alert => ban
        watcher.Alerts.pushAlerts([
            {
                capacity: 5,
                events: [
                    {
                        meta: [
                            { key: 'log_type', value: 'expressjslogs' },
                            { key: 'service', value: 'express-gateway' },
                            { key: 'source_ip', value: fakeSource },
                            { key: 'timestamp', value: new Date().toISOString() },
                            { key: 'user-agent', value: badUserAgent }
                        ],
                        timestamp: new Date().toISOString()
                    }
                ],
                events_count: 1,
                leakspeed: '20s',
                message: `Ip ${fakeSource} performed ${scenarioName} (1 event) at ${new Date().toISOString()}`,
                remediation: false,
                scenario: scenarioName,
                scenario_hash: 'c41f3f4003eeb331fa35aa2ace0e861a674992efdb5a26c5f9d447db40a67eca',
                scenario_version: '0.1',
                simulated: false,
                source: {
                    ip: fakeSource,
                    scope: 'Ip',
                    value: fakeSource
                },
                start_at: new Date().toISOString(),
                stop_at: new Date().toISOString()
            }
        ]).catch((e) => console.error('fail to push alerts', e));
    }
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
