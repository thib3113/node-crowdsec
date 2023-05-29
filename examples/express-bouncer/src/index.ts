import * as dotenv from 'dotenv';
import { BouncerClient } from 'crowdsec-client';
import express from 'express';

dotenv.config();

// create main function to deal with async/await
const main = async () => {
    let bannedIps: Array<string> = ['::1'];

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
    const stream = client.Decisions.getStream({ interval: 2000, scopes: 'ip' });

    //listen for added decisions
    stream.on('added', (decision) => {
        if (!bannedIps.includes(decision.value)) {
            bannedIps.push(decision.value);
        }
    });

    //listen for deleted decisions
    stream.on('deleted', (decision) => {
        bannedIps = bannedIps.filter((ip) => ip === decision.value);
    });

    //start the stream
    stream.resume();

    //now start the express server
    const app = express();
    const port = 3000;

    app.use((req, res, next) => {
        //just a basic check to illustrate
        if (req.socket.remoteAddress && bannedIps.includes(req.socket.remoteAddress)) {
            //do something if the ip is banned
            res.status(401).send('BANNED');
            return;
        }

        console.log(bannedIps.length);

        next();
    });

    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`);
    });
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
