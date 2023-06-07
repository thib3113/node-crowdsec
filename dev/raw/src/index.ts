import { BouncerClient, Decision, WatcherClient } from 'crowdsec-client';
import dotenv from 'dotenv';

dotenv.config({
    path: '../../.env'
});

dotenv.config();

// create main function to deal with async/await
const main = async () => {
    if (!process.env.CROWDSEC_URL) {
        throw new Error('need process.env.CROWDSEC_URL');
    }
    //
    // const client = new WatcherClient({
    //     url: process.env.CROWDSEC_URL,
    //     auth: {
    //         machineID: process.env.CROWDSEC_MACHINE_ID || '',
    //         password: process.env.CROWDSEC_PASSWORD || ''
    //     },
    //     strictSSL: false
    // });
    //
    // await client.login();
    //
    // const res = await client.Alerts.search({ has_active_decision: true, origin: 'cscli' });
    // console.log(res);

    const client = new BouncerClient({
        url: process.env.CROWDSEC_URL,
        auth: {
            apiKey: process.env.CROWDSEC_API_KEY || ''
        },
        strictSSL: false
    });
    await client.login();

    const decisionsStream = client.Decisions.getStream({
        scopes: 'ip'
    });

    decisionsStream.on('added', (decision: Decision) => {
        console.log(`add ${decision.scope} ${decision.value}`);
    });

    decisionsStream.on('deleted', (decision: Decision) => {
        console.log(`delete ${decision.scope} ${decision.value}`);
    });

    decisionsStream.resume();
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
