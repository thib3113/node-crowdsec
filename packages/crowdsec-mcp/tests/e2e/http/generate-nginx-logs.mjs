import { appendFileSync, mkdirSync, statSync, truncateSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const logPath = '/var/log/nginx/access.log';
const maxSize = 20 * 1024 * 1024;

const attackers = ['203.0.113.66'];
const benignIps = ['198.51.100.23', '192.0.2.44', '203.0.113.10', '192.0.2.88'];
const scanPaths = [
    '/.env',
    '/wp-login.php',
    '/phpmyadmin/',
    '/admin',
    '/server-status',
    '/.git/config',
    '/actuator/env',
    '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
    '/config.json',
    '/backup.zip',
    '/xmlrpc.php',
    '/cgi-bin/luci',
    '/solr/admin/info/system',
    '/console/login/LoginForm.jsp',
    '/owa/auth/logon.aspx'
];
const normalPaths = ['/', '/index.html', '/api/health', '/assets/app.css', '/robots.txt', '/favicon.ico'];
const userAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'curl/8.5.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
    'sqlmap/1.8.7#stable (https://sqlmap.org)'
];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

mkdirSync(dirname(logPath), { recursive: true });
writeFileSync(logPath, '');

function pick(values) {
    return values[Math.floor(Math.random() * values.length)];
}

function timestamp(date) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${day}/${month}/${year}:${hours}:${minutes}:${seconds} +0000`;
}

function accessLine(ip, path, status) {
    const bytes = status === 200 ? 512 + Math.floor(Math.random() * 4096) : 162 + Math.floor(Math.random() * 300);
    return `${ip} - - [${timestamp(new Date())}] "GET ${path} HTTP/1.1" ${status} ${bytes} "-" "${pick(userAgents)}"\n`;
}

function rotateIfNeeded() {
    try {
        if (statSync(logPath).size > maxSize) {
            truncateSync(logPath, 0);
        }
    } catch {
        // The file may not exist yet.
    }
}

let lines = 0;

setInterval(() => {
    rotateIfNeeded();

    let batch = '';
    for (let i = 0; i < 12; i++) {
        batch += accessLine(pick(attackers), pick(scanPaths), 404);
    }
    for (let i = 0; i < 8; i++) {
        batch += accessLine(pick(benignIps), pick(normalPaths), 200);
    }

    appendFileSync(logPath, batch);
    lines += 20;

    if (lines % 200 === 0) {
        console.log(`[nginx-logs] ${lines} lines written to ${logPath}`);
    }
}, 1000);

console.log(`[nginx-logs] writing realistic nginx access logs to ${logPath}`);
