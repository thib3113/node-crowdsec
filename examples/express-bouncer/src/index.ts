import * as dotenv from 'dotenv';
import { BouncerClient } from 'crowdsec-client';

dotenv.config();

// create main function to deal with async/await
const main = async () => {
    if (!process.env.CROWDSEC_URL) {
        throw new Error('need process.env.CROWDSEC_URL');
    }

    //create object and login
    const client = new BouncerClient({
        url: process.env.CROWDSEC_URL,
        auth: {
            apiKey: process.env.CROWDSEC_API_KEY || ''
        },
        strictSSL: false
    });
    await client.login();

    //ask for stream => only ip scope managed by this example
    const stream = client.Decisions.getStream({ interval: 10000, scopes: 'ip' });

    //listen for added decisions
    stream.on('added', (decision) => {
        console.log(`added ${decision.value}`);
    });

    //listen for deleted decisions
    stream.on('deleted', (decision) => {
        console.log(`deleted ${decision.value}`);
    });

    //start the stream
    stream.resume();
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
