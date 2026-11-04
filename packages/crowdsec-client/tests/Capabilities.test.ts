import { describe, expect, it } from 'vitest';
import { CAPABILITY_MIN_VERSION, CapabilityContext, compareLapiVersions, interpretProbe, parseLapiVersion } from '../src/Capabilities.js';
import { FeatureNotSupportedError } from '../src/Errors/FeatureNotSupportedError.js';
import { LapiVersionUnknownError } from '../src/Errors/LapiVersionUnknownError.js';
import { Alerts } from '../src/Alerts/Alerts.js';
import { Allowlists } from '../src/Allowlists/Allowlists.js';
import type { AxiosInstance } from 'axios';

const fakeHttp = {} as AxiosInstance;

describe('Capabilities', () => {
    it('parses semver with an optional v prefix', () => {
        expect(parseLapiVersion('1.6.6')).toEqual([1, 6, 6]);
        expect(parseLapiVersion('v1.8.2')).toEqual([1, 8, 2]);
        expect(parseLapiVersion('1.7')).toBeNull();
        expect(parseLapiVersion('1.8.2-beta')).toBeNull();
        expect(parseLapiVersion('1.8.2foo')).toBeNull();
    });

    it('compares versions', () => {
        expect(compareLapiVersions('1.6.6', '1.6.6')).toBe(0);
        expect(compareLapiVersions('1.6.5', '1.6.6')).toBe(-1);
        expect(compareLapiVersions('1.7.0', '1.6.9')).toBe(1);
    });

    it('resolves every capability from a declared version', () => {
        const context = new CapabilityContext({ version: '1.6.6' });

        expect(context.supports('containsFilter')).toBe(true);
        expect(context.supports('streamScopes')).toBe(true);
        expect(context.supports('heartbeat')).toBe(true);
        expect(context.supports('decisionScopesDelete')).toBe(true);
        expect(context.supports('allowlists')).toBe(true);
        expect(context.supports('allowlistsBulkCheck')).toBe(false);
        expect(context.supports('alertKindFilter')).toBe(false);
        expect(context.getCapabilities().source).toBe('declared');
    });

    it('estimates a probable version range from probes', () => {
        const context = new CapabilityContext();
        context.applyProbes({ heartbeat: true, allowlists: false });

        expect(context.getCapabilities().estimate).toEqual({
            minVersion: '1.4.0',
            belowVersion: '1.6.6',
            probable: '>=1.4.0 <1.6.6'
        });
    });

    it('narrows the range with newer capabilities', () => {
        const context = new CapabilityContext();
        context.applyProbes({ allowlists: true, allowlistsBulkCheck: true, alertKindFilter: false });

        expect(context.getCapabilities().estimate.probable).toBe('>=1.6.9 <1.7.7');
    });

    it('reports an exact version when declared', () => {
        const context = new CapabilityContext({ version: '1.8.2' });

        expect(context.getCapabilities().estimate).toEqual({
            exactVersion: '1.8.2',
            minVersion: '1.8.2',
            probable: '1.8.2'
        });
    });

    it('returns unknown without any information', () => {
        expect(new CapabilityContext().getCapabilities().estimate).toEqual({ probable: 'unknown' });
    });

    it('infers older capabilities from a newer one and newer ones from a failure', () => {
        const context = new CapabilityContext();
        context.applyProbes({ allowlists: true, alertKindFilter: false });

        expect(context.supports('allowlists')).toBe(true);
        expect(context.supports('alertDeleteById')).toBe(true);
        expect(context.supports('alertKindFilter')).toBe(false);
        expect(context.supports('lapiMetricsFeatures')).toBe(false);
        expect(context.getCapabilities().source).toBe('probed');
    });

    it('learns a capability from a real request without inferring the others', () => {
        const context = new CapabilityContext();
        context.learn('decisionScopesDelete', false);

        expect(context.supports('decisionScopesDelete')).toBe(false);
        // A request-level observation must not disable unrelated capabilities.
        expect(context.supports('heartbeat')).toBeUndefined();
        expect(context.getCapabilities().source).toBe('observed');

        const declared = new CapabilityContext({ version: '1.8.2' });
        declared.learn('decisionScopesDelete', false);
        expect(declared.supports('decisionScopesDelete')).toBe(true);
        expect(declared.getCapabilities().source).toBe('declared');
    });

    it('does not narrow the probable version from a learned value', () => {
        const context = new CapabilityContext();
        context.learn('decisionScopesDelete', false);

        // A single rejected request must not advertise an older LAPI version.
        expect(context.getCapabilities().estimate.probable).toBe('unknown');
    });

    it('keeps a probed source when an additional value is learned', () => {
        const context = new CapabilityContext();
        // heartbeat (1.4.0) leaves the newer capabilities unresolved.
        context.applyProbes({ heartbeat: true });
        expect(context.supports('alertDeleteById')).toBeUndefined();

        context.learn('alertDeleteById', true);

        expect(context.supports('alertDeleteById')).toBe(true);
        expect(context.getCapabilities().source).toBe('probed');
    });

    it('does not propagate a learned value on a later probe', () => {
        const context = new CapabilityContext();
        context.learn('heartbeat', false);

        // A later probe must not turn the learned heartbeat failure into a
        // false negative for allowlists and the other newer capabilities.
        context.applyProbes({ allowlists: true });

        expect(context.supports('allowlists')).toBe(true);
        expect(context.supports('allowlistsBulkCheck')).toBeUndefined();
        expect(context.supports('heartbeat')).toBe(false);
        expect(context.supports('lapiMetricsFeatures')).toBeUndefined();
    });

    it('lets an explicit probe override a previous observation', () => {
        const context = new CapabilityContext();
        context.learn('heartbeat', false);
        expect(context.supports('heartbeat')).toBe(false);

        context.applyProbes({ heartbeat: true });
        expect(context.supports('heartbeat')).toBe(true);
        expect(context.getCapabilities().source).toBe('probed');

        // The stale observation must not come back on the next probe.
        context.applyProbes({});
        expect(context.supports('heartbeat')).toBe(true);
    });

    it('lets an observation correct a value that was only inferred', () => {
        const context = new CapabilityContext();
        // decisionOriginsFilter (1.3.3) failing infers decisionScopesDelete
        // (same minimum) as unsupported.
        context.applyProbes({ decisionOriginsFilter: false });
        expect(context.supports('decisionScopesDelete')).toBe(false);

        context.learn('decisionScopesDelete', true);
        expect(context.supports('decisionScopesDelete')).toBe(true);

        // The correction survives another probe and remains non-propagating.
        context.applyProbes({});
        expect(context.supports('decisionScopesDelete')).toBe(true);
        expect(context.supports('allowlists')).toBe(false);
    });

    it('drops a declared version when a forced probe contradicts it', () => {
        const context = new CapabilityContext({ version: '1.8.2' });
        context.applyProbes({ allowlists: false });

        expect(context.getCapabilities().version).toBeUndefined();
        expect(context.getCapabilities().source).toBe('probed');
        expect(context.getCapabilities().estimate.probable).not.toBe('1.8.2');
    });

    it('rejects an unknown capability name at runtime', () => {
        const context = new CapabilityContext();

        expect(() => context.supports('notARealCapability' as never)).toThrow(/unknown CrowdSec LAPI capability/);
        expect(() => context.learn('notARealCapability' as never, true)).toThrow(/unknown CrowdSec LAPI capability/);
    });

    it('leaves unrelated capabilities unknown', () => {
        const context = new CapabilityContext();
        context.applyProbes({ streamScopes: true });

        expect(context.supports('streamScopes')).toBe(true);
        expect(context.supports('containsFilter')).toBe(true);
        expect(context.supports('allowlists')).toBeUndefined();
    });

    it('throws on a known-unsupported capability', () => {
        const context = new CapabilityContext({ version: '1.5.0' });

        expect(() => context.assertSupport('allowlists')).toThrow(FeatureNotSupportedError);

        try {
            context.assertSupport('allowlists');
        } catch (error) {
            expect(error).toBeInstanceOf(FeatureNotSupportedError);
            expect((error as FeatureNotSupportedError).minimumVersion).toBe(CAPABILITY_MIN_VERSION.allowlists);
            expect((error as FeatureNotSupportedError).detectedVersion).toBe('1.5.0');
        }
    });

    it('throws on unknown capabilities only in strict mode', () => {
        expect(() => new CapabilityContext().assertSupport('allowlists')).not.toThrow();
        expect(() => new CapabilityContext({ strict: true }).assertSupport('allowlists')).toThrow(LapiVersionUnknownError);
    });

    it('rejects an invalid declared version', () => {
        expect(() => new CapabilityContext({ version: 'one' })).toThrow(/invalid lapiVersion/);
    });

    it('interprets probe statuses', () => {
        expect(interpretProbe('allowlists', 200)).toBe(true);
        expect(interpretProbe('allowlists', 400)).toBe(true);
        // 401 proves nothing about the route (unauthenticated probe); 403 does.
        expect(interpretProbe('allowlists', 401)).toBeUndefined();
        expect(interpretProbe('allowlists', 403)).toBe(true);
        expect(interpretProbe('allowlists', 404)).toBe(false);
        expect(interpretProbe('allowlists', undefined)).toBeUndefined();
        expect(interpretProbe('allowlistsBulkCheck', 400)).toBe(true);
        expect(interpretProbe('allowlistsBulkCheck', 405)).toBe(false);

        expect(interpretProbe('alertKindFilter', 200)).toBe(true);
        expect(interpretProbe('alertKindFilter', 500)).toBe(false);
        expect(interpretProbe('alertKindFilter', 401)).toBeUndefined();

        // `origin` on `/v1/alerts` answers 500 before 1.3.0; it must be read as
        // unsupported, like the other filters.
        expect(interpretProbe('alertOriginFilter', 200)).toBe(true);
        expect(interpretProbe('alertOriginFilter', 500)).toBe(false);
    });

    it('gates client methods before sending a request', async () => {
        const old = new CapabilityContext({ version: '1.2.0' });
        const alerts = new Alerts({ httpClient: fakeHttp, capabilities: old });

        await expect(alerts.search({ kind: 'cscli' })).rejects.toBeInstanceOf(FeatureNotSupportedError);
        await expect(alerts.deleteById('1')).rejects.toBeInstanceOf(FeatureNotSupportedError);

        const modern = new CapabilityContext({ version: '1.8.0' });
        expect(new Allowlists({ httpClient: fakeHttp, capabilities: modern }).list).toBeDefined();
        await expect(new Allowlists({ httpClient: fakeHttp, capabilities: old }).list()).rejects.toBeInstanceOf(FeatureNotSupportedError);
    });
});
