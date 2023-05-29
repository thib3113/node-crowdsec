import dotenv from 'dotenv';
import { BouncerClient } from '../src/index.js';

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

    //ask for stream
    const stream = client.Decisions.getStream({ interval: 2000 });

    //listen for added decisions
    stream.on('added', (decision) => {
        if (decision.endAt.getTime() < Date.now()) {
            debugger;
        }

        if (decision.until) {
            debugger;
        }

        console.log(decision);
    });

    //listen for deleted decisions
    stream.on('deleted', (decision) => {
        if (decision.until) {
            debugger;
        }

        console.log(decision);
    });

    //start the stream
    stream.resume();

    //can also be done with a CB

    // with CB
    // client.Decisions.getStream({ interval: 2000 } , (err, data?: CallBackParams) => {
    //     if (err) {
    //         console.error(err);
    //         return;
    //     }
    //
    //     if (!data) {
    //         console.error('no data passed');
    //         return;
    //     }
    //
    //     const { type, decision } = data;
    //
    //     if (type === 'added' && decision.endAt.getTime() < Date.now()) {
    //         debugger;
    //     }
    //
    //     if (decision.until) {
    //         debugger;
    //     }
    //
    //     console.log(decision);
    // });
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
