import { parseArgs } from 'node:util';
import { parseDuration, splitList } from './utils.js';
import { NAME, VERSION } from './version.js';

export type AuthMode = 'bouncer' | 'watcher';
export type TransportMode = 'stdio' | 'http';

export interface TlsConfig {
    cert: string;
    key: string;
    ca: string;
}

export interface HttpConfig {
    host: string;
    port: number;
    token?: string;
}

export interface Config {
    url: string;
    auth: AuthMode;
    apiKey?: string;
    machineId?: string;
    password?: string;
    tls?: TlsConfig;
    strictSSL: boolean;
    timeout: number;
    transport: TransportMode;
    http: HttpConfig;
    readonly: boolean;
    tools?: string[];
    disableTools: string[];
    maxResults: number;
    maxBanDuration: string;
    maxBanDurationSeconds: number;
}

const cliOptions = {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
    url: { type: 'string' },
    auth: { type: 'string' },
    'api-key': { type: 'string' },
    'machine-id': { type: 'string' },
    password: { type: 'string' },
    'tls-cert': { type: 'string' },
    'tls-key': { type: 'string' },
    'tls-ca': { type: 'string' },
    insecure: { type: 'boolean' },
    timeout: { type: 'string' },
    transport: { type: 'string' },
    'http-host': { type: 'string' },
    'http-port': { type: 'string' },
    'http-token': { type: 'string' },
    readonly: { type: 'boolean' },
    write: { type: 'boolean' },
    tools: { type: 'string' },
    'disable-tools': { type: 'string' },
    'max-results': { type: 'string' },
    'max-ban-duration': { type: 'string' }
} as const;

export type CliValues = ReturnType<typeof parseCliArgs>['values'];

export function parseCliArgs(argv = process.argv.slice(2)) {
    return parseArgs({
        args: argv,
        options: cliOptions,
        strict: true,
        allowPositionals: false
    });
}

function readBoolean(value: string | undefined, name: string, defaultValue: boolean): boolean {
    if (value === undefined || value === '') {
        return defaultValue;
    }

    switch (value.toLowerCase()) {
        case '1':
        case 'true':
        case 'yes':
        case 'on':
            return true;
        case '0':
        case 'false':
        case 'no':
        case 'off':
            return false;
        default:
            throw new Error(`${name} must be a boolean (true/false), got '${value}'`);
    }
}

function readInteger(value: string | undefined, name: string, defaultValue: number, min: number, max: number): number {
    if (value === undefined || value === '') {
        return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new Error(`${name} must be an integer between ${min} and ${max}, got '${value}'`);
    }

    return parsed;
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
    return values.find((value) => value !== undefined && value !== '');
}

export function loadConfig(values: CliValues, env: NodeJS.ProcessEnv = process.env): Config {
    const url = firstDefined(values.url as string | undefined, env.CROWDSEC_URL);
    if (!url) {
        throw new Error('CROWDSEC_URL (or --url) is required');
    }

    if (!/^https?:\/\//i.test(url)) {
        throw new Error(`CROWDSEC_URL must start with http:// or https://, got '${url}'`);
    }

    const apiKey = firstDefined(values['api-key'] as string | undefined, env.CROWDSEC_API_KEY);
    const machineId = firstDefined(values['machine-id'] as string | undefined, env.CROWDSEC_MACHINE_ID);
    const password = firstDefined(values.password as string | undefined, env.CROWDSEC_PASSWORD);
    const tlsCert = firstDefined(values['tls-cert'] as string | undefined, env.CROWDSEC_TLS_CERT);
    const tlsKey = firstDefined(values['tls-key'] as string | undefined, env.CROWDSEC_TLS_KEY);
    const tlsCa = firstDefined(values['tls-ca'] as string | undefined, env.CROWDSEC_TLS_CA);

    const requestedAuth = firstDefined(values.auth as string | undefined, env.CROWDSEC_AUTH)?.toLowerCase();
    if (requestedAuth !== undefined && requestedAuth !== 'bouncer' && requestedAuth !== 'watcher') {
        throw new Error(`CROWDSEC_AUTH must be 'bouncer' or 'watcher', got '${requestedAuth}'`);
    }

    let auth: AuthMode;
    if (requestedAuth) {
        auth = requestedAuth;
    } else if (apiKey) {
        auth = 'bouncer';
    } else if (machineId || password) {
        auth = 'watcher';
    } else {
        throw new Error('unable to detect authentication mode: set CROWDSEC_API_KEY or CROWDSEC_MACHINE_ID/CROWDSEC_PASSWORD');
    }

    const tlsValues = [tlsCert, tlsKey, tlsCa];
    const tlsCount = tlsValues.filter(Boolean).length;
    if (tlsCount !== 0 && tlsCount !== 3) {
        throw new Error('TLS authentication requires CROWDSEC_TLS_CERT, CROWDSEC_TLS_KEY and CROWDSEC_TLS_CA together');
    }

    const tls = tlsCount === 3 ? { cert: tlsCert!, key: tlsKey!, ca: tlsCa! } : undefined;

    if (auth === 'bouncer' && !apiKey && !tls) {
        throw new Error('bouncer authentication requires CROWDSEC_API_KEY or TLS certificates');
    }

    if (auth === 'watcher' && !tls && (!machineId || !password)) {
        throw new Error('watcher authentication requires CROWDSEC_MACHINE_ID and CROWDSEC_PASSWORD (or TLS certificates)');
    }

    const transport = (firstDefined(values.transport as string | undefined, env.CROWDSEC_MCP_TRANSPORT) ?? 'stdio').toLowerCase();
    if (transport !== 'stdio' && transport !== 'http') {
        throw new Error(`CROWDSEC_MCP_TRANSPORT must be 'stdio' or 'http', got '${transport}'`);
    }

    const httpToken = firstDefined(values['http-token'] as string | undefined, env.CROWDSEC_MCP_HTTP_TOKEN);
    if (transport === 'http' && !httpToken) {
        throw new Error('HTTP transport requires CROWDSEC_MCP_HTTP_TOKEN (or --http-token)');
    }

    if (values.readonly === true && values.write === true) {
        throw new Error('--readonly and --write cannot be used together');
    }

    const readonlyDefault = readBoolean(env.CROWDSEC_MCP_READONLY, 'CROWDSEC_MCP_READONLY', true);
    const readonly = values.write === true ? false : values.readonly === true ? true : readonlyDefault;

    const strictSSL = values.insecure === true ? false : readBoolean(env.CROWDSEC_STRICT_SSL, 'CROWDSEC_STRICT_SSL', true);
    const timeout = readInteger((values.timeout as string | undefined) ?? env.CROWDSEC_TIMEOUT, 'CROWDSEC_TIMEOUT', 10000, 1, 600000);
    const httpPort = readInteger(
        (values['http-port'] as string | undefined) ?? env.CROWDSEC_MCP_HTTP_PORT,
        'CROWDSEC_MCP_HTTP_PORT',
        3939,
        1,
        65535
    );
    const maxResults = readInteger(
        (values['max-results'] as string | undefined) ?? env.CROWDSEC_MCP_MAX_RESULTS,
        'CROWDSEC_MCP_MAX_RESULTS',
        25,
        1,
        10000
    );

    const maxBanDuration = firstDefined(values['max-ban-duration'] as string | undefined, env.CROWDSEC_MCP_MAX_BAN_DURATION) ?? '24h';
    const maxBanDurationSeconds = parseDuration(maxBanDuration);

    return {
        url,
        auth,
        apiKey,
        machineId,
        password,
        tls,
        strictSSL,
        timeout,
        transport,
        http: {
            host: firstDefined(values['http-host'] as string | undefined, env.CROWDSEC_MCP_HTTP_HOST) ?? '127.0.0.1',
            port: httpPort,
            token: httpToken
        },
        readonly,
        tools: splitList(firstDefined(values.tools as string | undefined, env.CROWDSEC_MCP_TOOLS)),
        disableTools: splitList(firstDefined(values['disable-tools'] as string | undefined, env.CROWDSEC_MCP_DISABLE_TOOLS)) ?? [],
        maxResults,
        maxBanDuration,
        maxBanDurationSeconds
    };
}

export function redactedUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.username) parsed.username = '***';
        if (parsed.password) parsed.password = '***';
        return parsed.toString();
    } catch {
        return url;
    }
}

export function printHelp(): void {
    process.stdout.write(`Usage: ${NAME} [options]

Connection:
  --url <url>                 CrowdSec LAPI URL (env: CROWDSEC_URL)
  --auth <bouncer|watcher>    Authentication mode (env: CROWDSEC_AUTH)
  --api-key <key>             Bouncer API key (env: CROWDSEC_API_KEY)
  --machine-id <id>           Watcher machine ID (env: CROWDSEC_MACHINE_ID)
  --password <password>       Watcher password (env: CROWDSEC_PASSWORD)
  --tls-cert <path>           Client certificate (env: CROWDSEC_TLS_CERT)
  --tls-key <path>            Client key (env: CROWDSEC_TLS_KEY)
  --tls-ca <path>             CA certificate (env: CROWDSEC_TLS_CA)
  --insecure                  Disable TLS certificate validation
  --timeout <ms>              HTTP timeout, default 10000

MCP:
  --transport <stdio|http>    Transport, default stdio (env: CROWDSEC_MCP_TRANSPORT)
  --http-host <host>          HTTP host, default 127.0.0.1
  --http-port <port>          HTTP port, default 3939
  --http-token <token>        HTTP bearer token (required for HTTP)
  --readonly                  Force read-only mode (default)
  --write                     Enable write tools
  --tools <a,b>               Only expose these tools
  --disable-tools <a,b>       Hide these tools
  --max-results <n>           Default result limit, default 25
  --max-ban-duration <dur>    Maximum ban duration without force, default 24h

  -h, --help                  Show this help
  -v, --version               Show the version
`);
}

export function printVersion(): void {
    process.stdout.write(`${NAME} ${VERSION}\n`);
}
