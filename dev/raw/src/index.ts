import { IncomingMessage, ServerResponse } from 'http';
import * as http from 'http';
import { CrowdSecHTTPMiddleware } from 'crowdsec-http-middleware';
import { CrowdSecServerError, Decision, WatcherClient } from 'crowdsec-client';
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

    const middleware = new CrowdSecHTTPMiddleware({
        url: process.env.CROWDSEC_URL || '',
        watcher: {
            machineID: process.env.CROWDSEC_MACHINE_ID || '',
            password: process.env.CROWDSEC_PASSWORD || '',
            scenariosOptions: {
                'x-forwarded-for': {
                    trustedProxies: ['127.0.0.1', '::1', '192.168.0.0/16', '10.10.10.10']
                }
            }
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
        midFn(req, res);
        console.timeEnd('middleware');

        console.log('ip :', req.ip);
        console.log('decision :', req.decision);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, World!');
    });

    const port: number = 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
};

// //just run the async main, and log error if needed
main().catch((e) => console.error(e));
