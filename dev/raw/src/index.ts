import { CrowdSecServerError, WatcherClient } from 'crowdsec-client';
import dotenv from 'dotenv';

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

    const machineID = 'node-watcher';
    const password = 'myPassword';
    const watcherClient = new WatcherClient({
        url: process.env.CROWDSEC_URL,
        auth: {
            machineID,
            password
        },
        strictSSL: false
    });

    try {
        await watcherClient.login();
    } catch (e) {
        if (e instanceof CrowdSecServerError && e.code === 401) {
            try {
                await watcherClient.registerWatcher({
                    machine_id: machineID,
                    password
                });
            } catch (registerError) {
                if (registerError instanceof CrowdSecServerError && registerError.code === 403) {
                    throw new Error('watcher seems already register');
                }

                console.error(`unknown error when registering a watcher : `, registerError);
                throw registerError;
            }
        } else {
            console.error(`unknown error when login`, e);
        }
    }

    // const watcher = new WatcherClient({
    //     url: process.env.CROWDSEC_URL,
    //     auth: {
    //         cert: fs.readFileSync(path.join(TLSPath, 'agent.pem')),
    //         key: fs.readFileSync(path.join(TLSPath, 'agent-key.pem')),
    //         ca: fs.readFileSync(path.join(TLSPath, 'inter.pem'))
    //     },
    //     strictSSL: false
    // });

    // await watcher.login();
    //
    // const res = await watcher.Alerts.search({ has_active_decision: true, origin: 'cscli' });
    // console.log(res);

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
