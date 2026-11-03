import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig, parseCliArgs } from '../src/config.js';

const secretDir = mkdtempSync(join(tmpdir(), 'crowdsec-mcp-config-'));

afterAll(() => {
    rmSync(secretDir, { recursive: true, force: true });
});

function secretFile(name: string, content: string): string {
    const path = join(secretDir, name);
    writeFileSync(path, content);
    return path;
}

describe('config', () => {
    it('auto-detects bouncer authentication from the API key', () => {
        const config = loadConfig({}, { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_API_KEY: 'key' });

        expect(config.auth).toBe('bouncer');
        expect(config.readonly).toBe(true);
        expect(config.maxResults).toBe(25);
        expect(config.transport).toBe('stdio');
    });

    it('should not leak credentials from a rejected URL', () => {
        for (const url of ['ftp://user:secret@host', 'user:secret@host']) {
            let message = '';
            try {
                loadConfig({}, { CROWDSEC_URL: url, CROWDSEC_API_KEY: 'key' });
            } catch (error) {
                message = (error as Error).message;
            }

            expect(message).toContain('must start with');
            expect(message).not.toContain('secret');
        }
    });

    it('auto-detects watcher authentication from machine credentials', () => {
        const config = loadConfig(
            {},
            { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_MACHINE_ID: 'machine', CROWDSEC_PASSWORD: 'password' }
        );

        expect(config.auth).toBe('watcher');
        expect(config.machineId).toBe('machine');
    });

    it('prefers bouncer authentication when both credentials are provided', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_MACHINE_ID: 'machine',
                CROWDSEC_PASSWORD: 'password'
            }
        );

        expect(config.auth).toBe('bouncer');
        expect(config.watcher).toBe(true);
        expect(config.bouncer).toBe(true);
    });

    it('enables both clients when bouncer and watcher credentials coexist without CROWDSEC_AUTH', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_MACHINE_ID: 'machine',
                CROWDSEC_PASSWORD: 'password'
            }
        );

        expect(config.watcher).toBe(true);
        expect(config.bouncer).toBe(true);
    });

    it('does not invent a watcher from TLS when only an API key and TLS are supplied', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_TLS_CERT: '/tmp/cert.pem',
                CROWDSEC_TLS_KEY: '/tmp/key.pem',
                CROWDSEC_TLS_CA: '/tmp/ca.pem'
            }
        );

        expect(config.bouncer).toBe(true);
        expect(config.watcher).toBe(false);
    });

    it.each([
        ['CROWDSEC_MACHINE_ID only', { CROWDSEC_MACHINE_ID: 'machine' }],
        ['CROWDSEC_PASSWORD only', { CROWDSEC_PASSWORD: 'password' }]
    ])('ignores incomplete machine credentials when a bouncer key is configured (%s)', (_label, extra) => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                ...extra
            }
        );

        expect(config.watcher).toBe(false);
        expect(config.bouncer).toBe(true);
    });

    it.each([
        ['CROWDSEC_MACHINE_ID only', { CROWDSEC_MACHINE_ID: 'machine' }],
        ['CROWDSEC_PASSWORD only', { CROWDSEC_PASSWORD: 'password' }]
    ])('rejects incomplete machine credentials when they are the only auth source (%s)', (_label, extra) => {
        expect(() =>
            loadConfig(
                {},
                {
                    CROWDSEC_URL: 'https://crowdsec:8080',
                    ...extra
                }
            )
        ).toThrow(/must be provided together/);
    });

    it('uses TLS for the watcher when machine credentials are incomplete', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_MACHINE_ID: 'machine',
                CROWDSEC_TLS_CERT: '/tmp/cert.pem',
                CROWDSEC_TLS_KEY: '/tmp/key.pem',
                CROWDSEC_TLS_CA: '/tmp/ca.pem'
            }
        );

        expect(config.watcher).toBe(true);
        expect(config.bouncer).toBe(false);
    });

    it('does not require static credentials when passthrough is enabled', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_MCP_TRANSPORT: 'http',
                CROWDSEC_MCP_PASSTHROUGH: 'true',
                CROWDSEC_MCP_HTTP_TOKEN: 'service-token',
                CROWDSEC_AUTH: 'bouncer'
            }
        );

        expect(config.watcher).toBe(false);
        expect(config.bouncer).toBe(false);
    });

    it('honours explicit auth', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_AUTH: 'watcher',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_MACHINE_ID: 'machine',
                CROWDSEC_PASSWORD: 'password'
            }
        );

        expect(config.auth).toBe('watcher');
        expect(config.watcher).toBe(true);
        expect(config.bouncer).toBe(false);
    });

    it('rejects an invalid auth', () => {
        expect(() => loadConfig({}, { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_AUTH: 'invalid', CROWDSEC_API_KEY: 'key' })).toThrow(
            /CROWDSEC_AUTH/
        );
    });

    it('requires the three TLS files together', () => {
        expect(() =>
            loadConfig(
                {},
                {
                    CROWDSEC_URL: 'https://crowdsec:8080',
                    CROWDSEC_API_KEY: 'key',
                    CROWDSEC_TLS_CERT: '/tmp/cert.pem'
                }
            )
        ).toThrow(/TLS/);
    });

    it('defaults to watcher authentication when only TLS is configured', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_TLS_CERT: '/tmp/cert.pem',
                CROWDSEC_TLS_KEY: '/tmp/key.pem',
                CROWDSEC_TLS_CA: '/tmp/ca.pem'
            }
        );

        expect(config.auth).toBe('watcher');
        expect(config.tls).toEqual({ cert: '/tmp/cert.pem', key: '/tmp/key.pem', ca: '/tmp/ca.pem' });
    });

    it('keeps an explicit bouncer mode with TLS', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_AUTH: 'bouncer',
                CROWDSEC_TLS_CERT: '/tmp/cert.pem',
                CROWDSEC_TLS_KEY: '/tmp/key.pem',
                CROWDSEC_TLS_CA: '/tmp/ca.pem'
            }
        );

        expect(config.auth).toBe('bouncer');
    });

    it('requires a token for HTTP transport', () => {
        expect(() =>
            loadConfig(
                {},
                {
                    CROWDSEC_URL: 'https://crowdsec:8080',
                    CROWDSEC_API_KEY: 'key',
                    CROWDSEC_MCP_TRANSPORT: 'http'
                }
            )
        ).toThrow(/HTTP transport requires/);
    });

    it('accepts HTTP transport with a token', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_MCP_TRANSPORT: 'http',
                CROWDSEC_MCP_HTTP_TOKEN: 'secret'
            }
        );

        expect(config.transport).toBe('http');
        expect(config.http.token).toBe('secret');
    });

    it('allows passthrough HTTP without a service token', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_MCP_TRANSPORT: 'http',
                CROWDSEC_MCP_PASSTHROUGH: 'true'
            }
        );

        expect(config.passthrough).toBe(true);
        expect(config.http.token).toBeUndefined();
        expect(config.auth).toBe('watcher');
    });

    it('rejects passthrough over stdio', () => {
        expect(() =>
            loadConfig(
                {},
                {
                    CROWDSEC_URL: 'https://crowdsec:8080',
                    CROWDSEC_MCP_PASSTHROUGH: 'true'
                }
            )
        ).toThrow(/passthrough mode requires/);
    });

    it('parses the alert-delete passthrough override', () => {
        const enabled = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_MCP_ALLOW_ALERT_DELETE_WITHOUT_TOKEN: 'true'
            }
        );
        expect(enabled.allowAlertDeleteWithoutToken).toBe(true);

        const { values } = parseCliArgs(['--allow-alert-delete-without-token']);
        const fromCli = loadConfig(values, { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_API_KEY: 'key' });
        expect(fromCli.allowAlertDeleteWithoutToken).toBe(true);
    });

    it('enables writes with --write', () => {
        const { values } = parseCliArgs(['--write']);
        const config = loadConfig(values, { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_API_KEY: 'key' });

        expect(config.readonly).toBe(false);
    });

    it('reads comma-separated tool filters', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_MCP_TOOLS: 'crowdsec_status, list_alerts',
                CROWDSEC_MCP_DISABLE_TOOLS: 'delete_alerts'
            }
        );

        expect(config.tools).toEqual(['crowdsec_status', 'list_alerts']);
        expect(config.disableTools).toEqual(['delete_alerts']);
    });

    it('keeps delete_alerts disabled unless explicitly enabled', () => {
        const base = { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_API_KEY: 'key' };

        expect(loadConfig({}, base).enableAlertDelete).toBe(false);
        expect(loadConfig({}, { ...base, CROWDSEC_MCP_ENABLE_ALERT_DELETE: 'true' }).enableAlertDelete).toBe(true);

        const { values } = parseCliArgs(['--enable-alert-delete']);
        expect(loadConfig(values, base).enableAlertDelete).toBe(true);
    });

    it('rejects an invalid max-results', () => {
        expect(() =>
            loadConfig({}, { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_API_KEY: 'key', CROWDSEC_MCP_MAX_RESULTS: '0' })
        ).toThrow(/CROWDSEC_MCP_MAX_RESULTS/);
    });

    it('rejects an invalid URL', () => {
        expect(() => loadConfig({}, { CROWDSEC_URL: 'crowdsec:8080', CROWDSEC_API_KEY: 'key' })).toThrow(/http/);
    });

    it('reads and validates CROWDSEC_LAPI_VERSION', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'key',
                CROWDSEC_LAPI_VERSION: 'v1.8.2'
            }
        );

        expect(config.lapiVersion).toBe('v1.8.2');

        expect(() =>
            loadConfig(
                {},
                {
                    CROWDSEC_URL: 'https://crowdsec:8080',
                    CROWDSEC_API_KEY: 'key',
                    CROWDSEC_LAPI_VERSION: 'latest'
                }
            )
        ).toThrow(/CROWDSEC_LAPI_VERSION/);
    });

    it('accepts --lapi-version on the command line', () => {
        const config = loadConfig(parseCliArgs(['--lapi-version', '1.6.6']).values, {
            CROWDSEC_URL: 'https://crowdsec:8080',
            CROWDSEC_API_KEY: 'key'
        });

        expect(config.lapiVersion).toBe('1.6.6');
    });

    it('reads secrets from _FILE variables and strips the trailing newline', () => {
        const keyFile = secretFile('api_key', 'file-key\n');
        const machineFile = secretFile('machine_id', 'file-machine\n');
        const passwordFile = secretFile('password', 'file-password\n');

        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY_FILE: keyFile,
                CROWDSEC_MACHINE_ID_FILE: machineFile,
                CROWDSEC_PASSWORD_FILE: passwordFile
            }
        );

        expect(config.apiKey).toBe('file-key');
        expect(config.machineId).toBe('file-machine');
        expect(config.password).toBe('file-password');
        expect(config.watcher).toBe(true);
        expect(config.bouncer).toBe(true);
    });

    it('preserves spaces in a secret read from _FILE', () => {
        const keyFile = secretFile('spaced_key', '  spaced key  \n');

        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY_FILE: keyFile
            }
        );

        expect(config.apiKey).toBe('  spaced key  ');
    });

    it('lets the plain environment variable win over _FILE', () => {
        const keyFile = secretFile('ignored_key', 'file-key\n');

        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_API_KEY: 'env-key',
                CROWDSEC_API_KEY_FILE: keyFile
            }
        );

        expect(config.apiKey).toBe('env-key');
    });

    it('reports a missing secret file without leaking its path', () => {
        expect(() =>
            loadConfig(
                {},
                {
                    CROWDSEC_URL: 'https://crowdsec:8080',
                    CROWDSEC_API_KEY_FILE: join(secretDir, 'missing')
                }
            )
        ).toThrow(/CROWDSEC_API_KEY_FILE/);
    });

    it('rejects passthrough with TLS certificates instead of silently dropping them', () => {
        expect(() =>
            loadConfig(
                {},
                {
                    CROWDSEC_URL: 'https://crowdsec:8080',
                    CROWDSEC_MCP_TRANSPORT: 'http',
                    CROWDSEC_MCP_PASSTHROUGH: 'true',
                    CROWDSEC_TLS_CERT: '/tmp/cert.pem',
                    CROWDSEC_TLS_KEY: '/tmp/key.pem',
                    CROWDSEC_TLS_CA: '/tmp/ca.pem'
                }
            )
        ).toThrow(/passthrough mode does not support/);
    });
});
