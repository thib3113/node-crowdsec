import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { CrowdSecHTTPMiddleware } from 'crowdsec-http-middleware';
import { Decision, WatcherClient } from 'crowdsec-client';
import dotenv from 'dotenv';
import path from 'path';
import { AllowListEnricher, HTTPEnricher, MaxMindEnricher, XForwardedForChecker } from 'crowdsec-client-scenarios';

dotenv.config({
    path: '../../.env'
});

dotenv.config();

const TLSPath = '../../statics/tls/gen';

const maxMindPath = '../../statics';

// create main function to deal with async/await
const main = async () => {
    if (!process.env.CROWDSEC_URL) {
        throw new Error('need process.env.CROWDSEC_URL');
    }

    const middleware = new CrowdSecHTTPMiddleware({
        url: process.env.CROWDSEC_URL,
        clientOptions: {
            strictSSL: false
        },
        watcher: {
            // cert: fs.readFileSync(path.join(TLSPath, 'agent.pem')),
            // key: fs.readFileSync(path.join(TLSPath, 'agent-key.pem')),
            // ca: fs.readFileSync(path.join(TLSPath, 'inter.pem')),
            machineID: process.env.CROWDSEC_MACHINE_ID || '',
            password: process.env.CROWDSEC_PASSWORD || '',
            scenariosOptions: {
                'x-forwarded-for': {
                    trustedProxies: ['127.0.0.1', '::1', '192.168.0.0/16', '10.10.10.10']
                },
                'allow-list': {
                    allowed: ['1.2.3.4']
                },
                maxmind: {
                    paths: {
                        ASN: path.join(maxMindPath, 'GeoLite2-ASN.mmdb'),
                        city: path.join(maxMindPath, 'GeoLite2-City.mmdb')
                    }
                }
            },
            scenarios: [AllowListEnricher, XForwardedForChecker, HTTPEnricher, MaxMindEnricher]
        },
        bouncer: {
            apiKey: process.env.CROWDSEC_API_KEY || ''
        }
        // getCurrentIp: (req: IncomingMessage) => req.socket.remoteAddress || '1.1.1.1'
    });

    await middleware.start();

    const midFn = middleware.getMiddleware();

    const server = http.createServer((req: IncomingMessage & { ip?: string; decision?: Decision }, res: ServerResponse) => {
        console.log('get http request', req.method, req.url);
        console.time('middleware');
        try {
            midFn(req, res);
        } catch (e) {
            console.error('middleware error', e);
        }
        console.timeEnd('middleware');

        console.log('ip :', req.ip);
        console.log('decision :', req.decision);

        if (!req.decision) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Hello, World!');
            return;
        }

        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`You can't access this api, because you are : ${req.decision?.type}`);
    });

    const port: number = 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
};

// //just run the async main, and log error if needed
main().catch((e) => console.error(e));
