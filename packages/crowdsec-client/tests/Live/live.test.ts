import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    BouncerClient,
    CAPABILITY_MIN_VERSION,
    compareLapiVersions,
    FeatureNotSupportedError,
    LapiCapability,
    parseLapiVersion,
    toLapiCapability,
    WatcherClient
} from '../../src/index.js';
import type { LapiCapabilityInput } from '../../src/index.js';
import type { APITypes } from '../../src/index.js';

const live = process.env.CROWDSEC_LIVE === '1';
const url = process.env.CROWDSEC_URL;
const apiKey = process.env.CROWDSEC_API_KEY;
const machineId = process.env.CROWDSEC_MACHINE_ID;
const password = process.env.CROWDSEC_PASSWORD;
const strictSSL = process.env.CROWDSEC_STRICT_SSL !== 'false';
const tag = process.env.CROWDSEC_LAPI_VERSION;
const allowlistName = process.env.CROWDSEC_LIVE_ALLOWLIST;
const allowlistIp = process.env.CROWDSEC_LIVE_ALLOWLIST_IP ?? '198.51.100.10';
const countrySeeded = process.env.CROWDSEC_LIVE_COUNTRY === '1';

type LiveMode = 'both' | 'watcher' | 'bouncer';
const mode: LiveMode = (process.env.CROWDSEC_MODE as LiveMode | undefined) ?? 'both';
const wantWatcher = mode === 'both' || mode === 'watcher';
const wantBouncer = mode === 'both' || mode === 'bouncer';

const SEED_IP = '198.18.0.10';
const SEED_RANGE = '198.18.0.0/24';
const SEED_MULTI_IP = '198.18.0.77';
const SEED_SIMULATED_IP = '198.20.0.10';
const SEED_NO_DECISION_IP = '198.21.0.10';
const SEED_BY_ID_IP = '198.22.0.10';

const WATCHER_CAPABILITIES: LapiCapability[] = [
    LapiCapability.containsFilter,
    LapiCapability.alertOriginFilter,
    LapiCapability.heartbeat,
    LapiCapability.allowlists,
    LapiCapability.allowlistsBulkCheck,
    LapiCapability.alertKindFilter
];
const BOUNCER_CAPABILITIES: LapiCapability[] = [LapiCapability.containsFilter, LapiCapability.decisionOriginsFilter];

function expected(capability: LapiCapabilityInput): boolean | undefined {
    if (!tag || !parseLapiVersion(tag)) {
        return undefined;
    }
    return compareLapiVersions(tag, CAPABILITY_MIN_VERSION[toLapiCapability(capability)]) >= 0;
}

function expectTagWithinEstimate(client: WatcherClient | BouncerClient, label: string): void {
    if (!tag || !parseLapiVersion(tag)) {
        return;
    }

    const estimate = client.getProbableVersion();

    if (estimate.minVersion) {
        expect(compareLapiVersions(tag, estimate.minVersion), `${label} should be >= ${estimate.minVersion}`).toBeGreaterThanOrEqual(0);
    }
    if (estimate.belowVersion) {
        expect(compareLapiVersions(tag, estimate.belowVersion), `${label} should be < ${estimate.belowVersion}`).toBeLessThan(0);
    }
}

function makeWatcher(withVersion: boolean): WatcherClient {
    return new WatcherClient({
        url: url!,
        auth: { machineID: machineId!, password: password!, autoRenew: false },
        heartbeat: false,
        detectCapabilities: true,
        ...(withVersion && tag ? { lapiVersion: tag } : {}),
        strictSSL,
        timeout: 10_000
    });
}

function makeBouncer(withVersion: boolean): BouncerClient {
    return new BouncerClient({
        url: url!,
        auth: { apiKey: apiKey! },
        detectCapabilities: true,
        ...(withVersion && tag ? { lapiVersion: tag } : {}),
        strictSSL,
        timeout: 10_000
    });
}

function ipSource(ip: string): APITypes.Source {
    return { scope: 'Ip', value: ip, ip };
}

function rangeSource(range: string): APITypes.Source {
    return { scope: 'Range', value: range, range };
}

function makeDecision(scope: string, value: string, type = 'ban', simulated = false): APITypes.Decision {
    return {
        origin: 'cscli',
        type,
        scope,
        value,
        duration: '1h',
        scenario: 'node-live-e2e',
        simulated
    };
}

function makeAlert(options: {
    source: APITypes.Source;
    decisions?: APITypes.Decision[];
    kind?: string;
    simulated?: boolean;
}): APITypes.Alert {
    const now = new Date().toISOString();
    return {
        scenario: 'node-live-e2e',
        scenario_hash: '',
        scenario_version: '',
        message: 'node-live e2e alert',
        events_count: 1,
        start_at: now,
        stop_at: now,
        capacity: 0,
        leakspeed: '0',
        simulated: options.simulated ?? false,
        events: [],
        remediation: (options.decisions?.length ?? 0) > 0,
        decisions: options.decisions ?? [],
        source: options.source,
        ...(options.kind ? { kind: options.kind } : {})
    };
}

async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: any }> {
    try {
        return { ok: true, value: await fn() };
    } catch (error) {
        return { ok: false, error };
    }
}

describe.skipIf(!live)('live CrowdSec API matrix', () => {
    let watcher: WatcherClient;
    let bouncer: BouncerClient;
    let probeWatcher: WatcherClient;
    let probeBouncer: BouncerClient;

    let probeError: unknown;
    let seedError: unknown;
    let seeded: {
        ipAlert?: number;
        rangeAlert?: number;
        multiAlert?: number;
        simulatedAlert?: number;
        noDecisionAlert?: number;
    } = {};

    function supports(capability: LapiCapabilityInput): boolean | undefined {
        // Probe-driven clients first: gating must be validated against what the
        // client detected, not against the version table we declared on the
        // `watcher`/`bouncer` clients (which would make these assertions
        // tautological).
        const clients = [probeWatcher, probeBouncer, watcher, bouncer].filter((client): client is WatcherClient | BouncerClient =>
            Boolean(client)
        );

        for (const client of clients) {
            const value = client.supports(capability);
            if (value !== undefined) {
                return value;
            }
        }

        return expected(capability);
    }

    function ensureSeeded(): void {
        if (seedError) {
            throw seedError;
        }
    }

    async function pushAlert(alert: APITypes.Alert): Promise<number> {
        const ids = await watcher.Alerts.pushAlerts([alert] as APITypes.AddAlertsRequest);
        return Number(ids[0]);
    }

    async function expectGate<T>(capability: LapiCapabilityInput, fn: () => Promise<T>, check: (value: T) => void): Promise<void> {
        const state = supports(capability);

        if (state === false) {
            await expect(fn()).rejects.toBeInstanceOf(FeatureNotSupportedError);
            return;
        }

        if (state === true) {
            check(await fn());
            return;
        }

        // Unknown capability (no version and no probe): accept either the call
        // succeeding or the LAPI rejecting the filter.
        const result = await attempt(fn);
        if (result.ok) {
            check(result.value);
        }
    }

    beforeAll(async () => {
        if (!url) {
            throw new Error('CROWDSEC_URL is required');
        }
        if (wantWatcher && (!machineId || !password)) {
            throw new Error('CROWDSEC_MACHINE_ID and CROWDSEC_PASSWORD are required in watcher/both mode');
        }
        if (wantBouncer && !apiKey) {
            throw new Error('CROWDSEC_API_KEY is required in bouncer/both mode');
        }

        // Keep the fields typed, but leave the unused client undefined at
        // runtime: tests for that credential are skipped with skipIf below.
        watcher = (wantWatcher ? makeWatcher(true) : undefined) as WatcherClient;
        probeWatcher = (wantWatcher ? makeWatcher(false) : undefined) as WatcherClient;
        bouncer = (wantBouncer ? makeBouncer(true) : undefined) as BouncerClient;
        probeBouncer = (wantBouncer ? makeBouncer(false) : undefined) as BouncerClient;

        if (wantWatcher) {
            await watcher.login();
        }
        if (wantBouncer) {
            await bouncer.login();
        }

        try {
            if (wantWatcher) {
                await probeWatcher.login();
            }
            if (wantBouncer) {
                await probeBouncer.login();
            }
        } catch (error) {
            probeError = error;
        }

        if (!wantWatcher) {
            return;
        }

        try {
            const kind = supports('alertKindField') === true ? 'node-live' : undefined;

            seeded.ipAlert = await pushAlert(makeAlert({ source: ipSource(SEED_IP), decisions: [makeDecision('Ip', SEED_IP)], kind }));
            seeded.rangeAlert = await pushAlert(
                makeAlert({ source: rangeSource(SEED_RANGE), decisions: [makeDecision('Range', SEED_RANGE)], kind })
            );
            seeded.multiAlert = await pushAlert(
                makeAlert({
                    source: ipSource(SEED_MULTI_IP),
                    decisions: [makeDecision('Ip', SEED_MULTI_IP, 'ban'), makeDecision('Ip', SEED_MULTI_IP, 'captcha')],
                    kind
                })
            );
            seeded.noDecisionAlert = await pushAlert(makeAlert({ source: ipSource(SEED_NO_DECISION_IP), decisions: [], kind }));

            // Simulation support is old but the alert payload validation has
            // changed across releases; do not fail the whole matrix if this one
            // seed is rejected.
            try {
                seeded.simulatedAlert = await pushAlert(
                    makeAlert({
                        source: ipSource(SEED_SIMULATED_IP),
                        decisions: [makeDecision('Ip', SEED_SIMULATED_IP, 'ban', true)],
                        simulated: true,
                        kind
                    })
                );
            } catch {
                seeded.simulatedAlert = undefined;
            }
        } catch (error) {
            seedError = error;
        }
    }, 60_000);

    afterAll(async () => {
        await probeWatcher?.stop();
        await probeBouncer?.stop();
        await watcher?.stop();
        await bouncer?.stop();
    });

    it('detects capabilities without mismatch against the declared tag', () => {
        if (probeError) {
            throw probeError;
        }

        if (wantWatcher) {
            expect(probeWatcher.getCapabilities().source).toBe('probed');

            for (const capability of WATCHER_CAPABILITIES) {
                const detected = probeWatcher.supports(capability);
                const wanted = expected(capability);
                if (wanted !== undefined) {
                    // Every watcher capability below is probed, so a probe that
                    // returns `undefined` is a detection bug, not a skip.
                    expect(detected, `watcher ${capability} should be detected`).toBe(wanted);
                }
            }

            expectTagWithinEstimate(probeWatcher, 'watcher estimate');
            if (tag) {
                expect(watcher.getProbableVersion().exactVersion).toBe(tag);
            }
        }

        if (wantBouncer) {
            expect(probeBouncer.getCapabilities().source).toBe('probed');

            for (const capability of BOUNCER_CAPABILITIES) {
                const detected = probeBouncer.supports(capability);
                const wanted = expected(capability);
                if (wanted !== undefined) {
                    expect(detected, `bouncer ${capability} should be detected`).toBe(wanted);
                }
            }

            expectTagWithinEstimate(probeBouncer, 'bouncer estimate');
            if (tag) {
                expect(bouncer.getProbableVersion().exactVersion).toBe(tag);
            }
        }
    });

    it.skipIf(!wantBouncer)('lists decisions and reads their fields', async () => {
        ensureSeeded();

        const decisions = await bouncer.Decisions.search({});
        expect(Array.isArray(decisions)).toBe(true);

        const seededDecision = decisions.find((decision) => decision.value === SEED_IP);
        expect(seededDecision).toBeDefined();
        expect(seededDecision!.scope.toLowerCase()).toBe('ip');
        expect(seededDecision!.type).toBe('ban');

        // `/v1/decisions` does not return `until` on 1.8.1, even though the
        // field exists on the model. The client must still compute `endAt`
        // from `duration`.
        expect(seededDecision!.endAt).toBeInstanceOf(Date);
        expect(seededDecision!.endAt.getTime()).toBeGreaterThan(Date.now());
    });

    it.skipIf(!wantBouncer)('includes simulated decisions on the bouncer endpoint', async () => {
        ensureSeeded();
        if (!seeded.simulatedAlert) {
            return;
        }

        // `simulated` is a supported decision filter since 1.0.0; a failure here
        // is a regression, not an old-version limitation.
        const decisions = await bouncer.Decisions.search({ simulated: true });
        expect(decisions.some((decision) => decision.value === SEED_SIMULATED_IP)).toBe(true);
    });

    it.skipIf(!wantBouncer)('gates the contains filter on decisions', async () => {
        ensureSeeded();

        await expectGate(
            'containsFilter',
            () => bouncer.Decisions.search({ ip: SEED_RANGE, contains: false }),
            (decisions) => {
                expect(decisions.some((decision) => decision.value === SEED_IP)).toBe(true);
            }
        );
    });

    it.skipIf(!wantBouncer)('reads the decision stream and gates scopes/origins', async () => {
        const stream = await bouncer.Decisions.getRawStream({ startup: true });
        expect(Array.isArray(stream.new)).toBe(true);
        // `deleted` was added after 1.0.0; it is optional/null on old releases.
        if (stream.deleted !== undefined && stream.deleted !== null) {
            expect(Array.isArray(stream.deleted)).toBe(true);
        }

        await expectGate(
            'streamScopes',
            () => bouncer.Decisions.getRawStream({ scopes: ['ip'] }),
            (value) => expect(value).toHaveProperty('new')
        );
        await expectGate(
            'decisionOriginsFilter',
            () => bouncer.Decisions.getRawStream({ origins: ['cscli'] }),
            (value) => expect(value).toHaveProperty('new')
        );
    });

    it.skipIf(!wantWatcher)('lists alerts and filters by source, decision state and contains', async () => {
        ensureSeeded();

        const alerts = await watcher.Alerts.search({ limit: 10 });
        expect(Array.isArray(alerts)).toBe(true);

        const bySource = await watcher.Alerts.search({ scope: 'Ip', value: SEED_IP });
        expect(bySource.some((alert) => alert.source.value === SEED_IP)).toBe(true);

        const noDecision = await watcher.Alerts.search({ has_active_decision: false, limit: 0 });
        expect(noDecision.some((alert) => alert.source.value === SEED_NO_DECISION_IP)).toBe(true);

        await expectGate(
            'containsFilter',
            () => watcher.Alerts.search({ ip: SEED_RANGE, contains: false, limit: 0 }),
            (result) => {
                expect(result.some((alert) => alert.source.value === SEED_IP)).toBe(true);
            }
        );
    });

    it.skipIf(!wantWatcher)('gates alert kind and origin filters', async () => {
        ensureSeeded();

        await expectGate(
            'alertKindFilter',
            () => watcher.Alerts.search({ kind: 'node-live' }),
            (alerts) => expect(alerts.some((alert) => alert.source.value === SEED_IP)).toBe(true)
        );
        await expectGate(
            'alertOriginFilter',
            () => watcher.Alerts.search({ origin: 'cscli' }),
            (alerts) => expect(alerts.some((alert) => alert.source.value === SEED_IP)).toBe(true)
        );
    });

    it.skipIf(!wantWatcher)('reads one alert with decisions and versioned fields', async () => {
        ensureSeeded();

        const alert = await watcher.Alerts.getById(String(seeded.ipAlert));
        expect(alert.id).toBe(seeded.ipAlert);
        expect(alert.source.value).toBe(SEED_IP);
        expect(alert.decisions?.some((decision) => decision.value === SEED_IP)).toBe(true);

        if (supports('alertKindField') === true) {
            expect(alert.kind).toBe('node-live');
        }
        if (supports('uuidField') === true) {
            expect(alert.uuid).toBeTruthy();
        }
    });

    it.skipIf(!wantWatcher || !wantBouncer)('deletes an IP without deleting the Range decision that contains it', async () => {
        ensureSeeded();
        const state = supports('containsFilter');

        if (state === false) {
            await expect(watcher.Decisions.delete({ ip: SEED_IP, contains: false })).rejects.toBeInstanceOf(FeatureNotSupportedError);
            return;
        }

        const deleted = await watcher.Decisions.delete({ ip: SEED_IP, contains: false });
        expect(Number(deleted.nbDeleted)).toBeGreaterThan(0);

        const remaining = await bouncer.Decisions.search({ ip: SEED_RANGE, contains: false });
        expect(remaining.some((decision) => decision.value === SEED_RANGE)).toBe(true);
    });

    it.skipIf(!wantWatcher || !wantBouncer)('deletes a range by type and leaves other decision types', async () => {
        ensureSeeded();
        const state = supports('containsFilter');

        if (state === false) {
            await expect(watcher.Decisions.delete({ range: SEED_RANGE, contains: false, type: 'ban' })).rejects.toBeInstanceOf(
                FeatureNotSupportedError
            );
            return;
        }

        const deleted = await watcher.Decisions.delete({ range: SEED_RANGE, contains: false, type: 'ban' });
        expect(Number(deleted.nbDeleted)).toBeGreaterThan(0);

        const remaining = await bouncer.Decisions.search({ ip: SEED_MULTI_IP, contains: false });
        expect(remaining.some((decision) => decision.type === 'captcha')).toBe(true);
        expect(remaining.some((decision) => decision.type === 'ban')).toBe(false);
    });

    it.skipIf(!wantWatcher)('learns the scope delete parameter from a real call when the version is unknown', async () => {
        const bare = new WatcherClient({
            url: url!,
            auth: { machineID: machineId!, password: password!, autoRenew: false },
            heartbeat: false,
            strictSSL,
            timeout: 10_000
        });

        try {
            await bare.login();
            expect(bare.supports('decisionScopesDelete')).toBeUndefined();

            const first = await bare.Decisions.delete({ scopes: 'Country', value: 'ZZ' });
            expect(Number(first.nbDeleted)).toBe(0);
            expect(typeof bare.supports('decisionScopesDelete')).toBe('boolean');

            // The learned value must be reused on the next call.
            const second = await bare.Decisions.delete({ scopes: 'Country', value: 'ZZ' });
            expect(Number(second.nbDeleted)).toBe(0);
        } finally {
            await bare.stop();
        }
    });

    it.skipIf(!wantWatcher)('learns the scope delete parameter when the caller uses the singular scope', async () => {
        const bare = new WatcherClient({
            url: url!,
            auth: { machineID: machineId!, password: password!, autoRenew: false },
            heartbeat: false,
            strictSSL,
            timeout: 10_000
        });

        try {
            await bare.login();
            expect(bare.supports('decisionScopesDelete')).toBeUndefined();

            const result = await bare.Decisions.delete({ scope: 'Country', value: 'ZZ' });
            expect(Number(result.nbDeleted)).toBe(0);
            expect(typeof bare.supports('decisionScopesDelete')).toBe('boolean');
        } finally {
            await bare.stop();
        }
    });

    it.skipIf(!wantWatcher || !wantBouncer)('deletes non-IP scopes through the plural scopes filter', async () => {
        if (!countrySeeded) {
            return;
        }

        // The client normalizes this to `scope` before 1.4.0 when the version
        // is declared, and falls back on the first 500 when it is unknown.
        const deleted = await watcher.Decisions.delete({ scopes: 'Country', value: 'FR' });
        expect(Number(deleted.nbDeleted)).toBeGreaterThan(0);

        const remaining = await bouncer.Decisions.search({ value: 'FR' });
        expect(remaining).toHaveLength(0);
    });

    it.skipIf(!wantWatcher || !wantBouncer)('deletes a decision by id', async () => {
        const id = await pushAlert(makeAlert({ source: ipSource(SEED_BY_ID_IP), decisions: [makeDecision('Ip', SEED_BY_ID_IP)] }));
        expect(id).toBeGreaterThan(0);

        const decisions = await bouncer.Decisions.search({});
        const decision = decisions.find((candidate) => candidate.value === SEED_BY_ID_IP);
        expect(decision?.id).toBeDefined();

        const deleted = await watcher.Decisions.deleteById(String(decision!.id));
        expect(Number(deleted.nbDeleted)).toBe(1);
    });

    it.skipIf(!wantWatcher)('gates the scenario delete filter', async () => {
        await expectGate(
            'decisionScenarioDelete',
            () => watcher.Decisions.delete({ scenario: 'node-live-does-not-exist' }),
            (value) => expect(Number(value.nbDeleted)).toBeGreaterThanOrEqual(0)
        );
    });

    it.skipIf(!wantWatcher)('gates allowlists and checks a seeded allowlist', async () => {
        const state = supports('allowlists');

        if (state === false) {
            await expect(watcher.Allowlists.list()).rejects.toBeInstanceOf(FeatureNotSupportedError);
        } else if (state === true) {
            const allowlists = await watcher.Allowlists.list();
            expect(Array.isArray(allowlists)).toBe(true);

            if (allowlistName) {
                const allowlist = await watcher.Allowlists.get(allowlistName);
                expect(allowlist.name).toBe(allowlistName);

                const check = await watcher.Allowlists.check(allowlistIp);
                expect(check.allowlisted).toBe(true);
            }
        }

        const bulkState = supports('allowlistsBulkCheck');
        if (bulkState === false) {
            // On 1.6.6-1.6.8 the bulk route is missing, but bulkCheck falls back
            // to the single-value route when allowlists are supported.
            if (supports('allowlists') === false) {
                await expect(watcher.Allowlists.bulkCheck([allowlistIp])).rejects.toBeInstanceOf(FeatureNotSupportedError);
            } else if (allowlistName) {
                const bulk = await watcher.Allowlists.bulkCheck([allowlistIp]);
                expect(bulk.results.some((result) => result.target === allowlistIp)).toBe(true);
            }
        } else if (bulkState === true && allowlistName) {
            const bulk = await watcher.Allowlists.bulkCheck([allowlistIp]);
            expect(bulk.results.some((result) => result.target === allowlistIp)).toBe(true);
        }
    });

    it.skipIf(!wantWatcher)('reports alert deletion restrictions instead of silently failing', async () => {
        ensureSeeded();
        const state = supports('alertDeleteById');

        if (state === false) {
            await expect(watcher.Alerts.deleteById(String(seeded.ipAlert))).rejects.toBeInstanceOf(FeatureNotSupportedError);
            return;
        }

        const result = await attempt(() => watcher.Alerts.deleteById(String(seeded.ipAlert)));
        if (result.ok) {
            return;
        }

        // 403: route exists but deletion is LAPI-host-only.
        // 405: route did not exist yet (1.4.0/1.4.1 cannot be probed).
        expect([403, 404, 405]).toContain(result.error?.code);
    });
});
