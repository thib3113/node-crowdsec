import dotenv from 'dotenv';
import { WatcherClient } from './Clients/WatcherClient.js';

dotenv.config();

// create main function to deal with async/await
const main = async () => {
    if (!process.env.CROWDSEC_URL) {
        throw new Error('need process.env.CROWDSEC_URL');
    }

    const client = new WatcherClient({
        url: process.env.CROWDSEC_URL,
        auth: {
            machineID: process.env.CROWDSEC_MACHINE_ID || '',
            password: process.env.CROWDSEC_PASSWORD || ''
        },
        strictSSL: false
    });

    // const res = await client.registerWatcher({
    //     machine_id: process.env.CROWDSEC_MACHINE_ID || '',
    //     password: process.env.CROWDSEC_PASSWORD || ''
    // });

    await client.login();

    // has_active_decision=true&include_capi=false&limit=100

    const res = await client.Alerts.search({ has_active_decision: true, origin: 'cscli' });
    console.log(res);
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
