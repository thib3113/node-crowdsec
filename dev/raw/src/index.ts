import { BouncerClient, Decision, WatcherClient } from 'crowdsec-client';
import dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

dotenv.config({
    path: '../../.env'
});

dotenv.config();

const TLSPath = '../../tls/gen';

// create main function to deal with async/await
const main = async () => {
    if (!process.env.CROWDSEC_URL) {
        throw new Error('need process.env.CROWDSEC_URL');
    }

    const watcher = new WatcherClient({
        url: process.env.CROWDSEC_URL,
        auth: {
            cert: fs.readFileSync(path.join(TLSPath, 'agent.pem')),
            key: fs.readFileSync(path.join(TLSPath, 'agent-key.pem')),
            ca: fs.readFileSync(path.join(TLSPath, 'inter.pem'))
        },
        strictSSL: false
    });

    await watcher.login();

    const res = await watcher.Alerts.search({ has_active_decision: true, origin: 'cscli' });
    console.log(res);

    // const client = new BouncerClient({
    //     url: process.env.CROWDSEC_URL,
    //     auth: {
    //         apiKey: process.env.CROWDSEC_API_KEY || ''
    //     },
    //     strictSSL: false
    // });
    // await client.login();
    //
    // const decisionsStream = client.Decisions.getStream({
    //     scopes: 'ip'
    // });
    //
    // decisionsStream.on('added', (decision: Decision) => {
    //     console.log(`add ${decision.scope} ${decision.value}`);
    // });
    //
    // decisionsStream.on('deleted', (decision: Decision) => {
    //     console.log(`delete ${decision.scope} ${decision.value}`);
    // });
    //
    // decisionsStream.resume();
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
