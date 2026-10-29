import { describe, expect, it } from 'vitest';
import { loadConfig, parseCliArgs } from '../src/config.js';

describe('config', () => {
    it('auto-detects bouncer authentication from the API key', () => {
        const config = loadConfig({}, { CROWDSEC_URL: 'https://crowdsec:8080', CROWDSEC_API_KEY: 'key' });

        expect(config.auth).toBe('bouncer');
        expect(config.readonly).toBe(true);
        expect(config.maxResults).toBe(25);
        expect(config.transport).toBe('stdio');
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
    });

    it('honours explicit auth', () => {
        const config = loadConfig(
            {},
            {
                CROWDSEC_URL: 'https://crowdsec:8080',
                CROWDSEC_AUTH: 'watcher',
                CROWDSEC_MACHINE_ID: 'machine',
                CROWDSEC_PASSWORD: 'password'
            }
        );

        expect(config.auth).toBe('watcher');
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
});
