import * as dotenv from 'dotenv';
import { BouncerClient, Decision } from 'crowdsec-client';
import express from 'express';

dotenv.config();

//enabling this to get banned by the bouncer
const ENABLE_FAKE_DECISION = true;

// exemple of a decision, you can modify it to test
const FAKE_DECISION: Decision = new Decision({
    duration: '99h',
    type: 'ban',
    value: '127.0.0.1',
    origin: 'manual',
    scenario: 'fake_scenario',
    scope: 'ip'
});

// create main function to deal with async/await
const main = async () => {
    let decisions: Array<Decision> = [];

    if (ENABLE_FAKE_DECISION) {
        decisions.push(FAKE_DECISION);
    }

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
        if (!decisions.find((d) => d.value === d.value)) {
            decisions.push(decision);
        }
    });

    //listen for deleted decisions
    stream.on('deleted', (decision) => {
        decisions = decisions.filter(({ value }) => value !== decision.value);
    });

    //start the stream
    stream.resume();

    //now start the express server
    const app = express();
    const port = 3000;

    app.use((req, res, next) => {
        //just a basic check to illustrate
        const decision = decisions.find(({ value }) => value === req.socket.remoteAddress);
        if (decision) {
            //do something if the ip is banned
            res.status(401).send(`you are rejected because of rule ${decision.scope}:${decision.value} . decision : ${decision.type}`);
            return;
        }

        next();
    });

    app.get('/', (req, res) => {
        console.log(`receive connection from ${req.socket.remoteAddress}`);
        res.send('Hello World!');
    });

    app.listen(port, '127.0.0.1', () => {
        console.log(`Example app listening on port ${port}`);
    });
};

//just run the async main, and log error if needed
main().catch((e) => console.error(e));
