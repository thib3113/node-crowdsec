import { CrowdsecClientError } from './Errors/CrowdsecClientError.js';
import { FeatureNotSupportedError } from './Errors/FeatureNotSupportedError.js';
import { LapiVersionUnknownError } from './Errors/LapiVersionUnknownError.js';

/**
 * CrowdSec LAPI capabilities the client can gate on.
 *
 * The minimum version is the first stable release where the behaviour works,
 * which is not always the version where it was documented in the swagger.
 *
 * Some entries (`uuidField`, `registrationToken`, `usageMetrics`,
 * `alertKindField`, `lapiMetricsFeatures`, `decisionUntilField`) are
 * informational for now: they are not used by `requireCapability` yet.
 */
export enum LapiCapability {
    containsFilter = 'containsFilter',
    streamScopes = 'streamScopes',
    alertOriginFilter = 'alertOriginFilter',
    decisionUntilField = 'decisionUntilField',
    decisionOriginsFilter = 'decisionOriginsFilter',
    heartbeat = 'heartbeat',
    alertDeleteById = 'alertDeleteById',
    decisionScenarioDelete = 'decisionScenarioDelete',
    decisionScopesDelete = 'decisionScopesDelete',
    uuidField = 'uuidField',
    registrationToken = 'registrationToken',
    usageMetrics = 'usageMetrics',
    allowlists = 'allowlists',
    allowlistsBulkCheck = 'allowlistsBulkCheck',
    watcherSelfDelete = 'watcherSelfDelete',
    alertKindField = 'alertKindField',
    alertKindFilter = 'alertKindFilter',
    lapiMetricsFeatures = 'lapiMetricsFeatures'
}

/**
 * A capability accepted on the public API: either the enum member
 * (`LapiCapability.heartbeat`) or its raw string value (`'heartbeat'`).
 */
export type LapiCapabilityInput = LapiCapability | `${LapiCapability}`;

/** Normalize a capability input to its enum member. */
export function toLapiCapability(capability: LapiCapabilityInput): LapiCapability {
    if (!Object.prototype.hasOwnProperty.call(CAPABILITY_MIN_VERSION, capability)) {
        throw new CrowdsecClientError(`unknown CrowdSec LAPI capability: ${String(capability)}`);
    }

    return capability as LapiCapability;
}

export const CAPABILITY_MIN_VERSION: Record<LapiCapability, string> = {
    [LapiCapability.containsFilter]: '1.0.3',
    [LapiCapability.streamScopes]: '1.1.0',
    [LapiCapability.alertOriginFilter]: '1.3.0',
    [LapiCapability.decisionUntilField]: '1.3.0',
    [LapiCapability.decisionOriginsFilter]: '1.3.3',
    [LapiCapability.heartbeat]: '1.4.0',
    [LapiCapability.alertDeleteById]: '1.4.2',
    [LapiCapability.decisionScenarioDelete]: '1.4.2',
    [LapiCapability.decisionScopesDelete]: '1.3.3',
    [LapiCapability.uuidField]: '1.5.0',
    [LapiCapability.registrationToken]: '1.6.3',
    [LapiCapability.usageMetrics]: '1.6.3',
    [LapiCapability.allowlists]: '1.6.6',
    [LapiCapability.allowlistsBulkCheck]: '1.6.9',
    [LapiCapability.watcherSelfDelete]: '1.6.9',
    [LapiCapability.alertKindField]: '1.7.7',
    [LapiCapability.alertKindFilter]: '1.7.7',
    [LapiCapability.lapiMetricsFeatures]: '1.8.2'
};

export type LapiVersion = [number, number, number];

export function parseLapiVersion(version: string): LapiVersion | null {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
    if (!match) {
        return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareLapiVersions(a: string, b: string): number {
    const left = parseLapiVersion(a);
    const right = parseLapiVersion(b);

    if (!left || !right) {
        throw new CrowdsecClientError(`invalid CrowdSec LAPI version: ${!left ? a : b}`);
    }

    for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i]) {
            return left[i] < right[i] ? -1 : 1;
        }
    }

    return 0;
}

export type CapabilitySource = 'unknown' | 'declared' | 'probed' | 'observed';

export interface LapiVersionEstimate {
    /** Declared version, when the caller provided one. */
    exactVersion?: string;
    /** Highest version proven by a capability that works. */
    minVersion?: string;
    /** Lowest version proven unsupported: exclusive upper bound. */
    belowVersion?: string;
    /** Human-readable range, e.g. `>=1.6.9 <1.7.7`. */
    probable: string;
}

export interface LapiCapabilityState {
    /** Where the values come from. */
    source: CapabilitySource;
    /** Declared LAPI version, when the caller provided one. */
    version?: string;
    /** Best guess of the LAPI version, derived from the known capabilities. */
    estimate: LapiVersionEstimate;
    /** `undefined` means the capability could not be determined. */
    values: Partial<Record<LapiCapability, boolean>>;
}

export interface CapabilityGuard {
    getCapabilities(): LapiCapabilityState;
    supports(capability: LapiCapabilityInput): boolean | undefined;
    assertSupport(capability: LapiCapabilityInput): void;
    /**
     * Record a capability observed on a real request; never overrides a
     * declared/probed value. Unlike a probe, this is a side signal: it is not
     * used to infer the other capabilities.
     */
    learn(capability: LapiCapabilityInput, supported: boolean): void;
}

const ALL_CAPABILITIES: Array<LapiCapability> = Object.values(LapiCapability);

/**
 * Propagate what is known through the version ordering: a capability that
 * works at version V means every capability with an older minimum also works,
 * and a capability that does not work at V means every newer one does not.
 *
 * This assumes features are introduced monotonically, which a backport can
 * violate (two capabilities with the same minimum are not necessarily shipped
 * together). Only deliberate version probes feed this function: values learned
 * from real requests are kept out so one rejected request cannot disable
 * unrelated features.
 */
function inferCapabilities(values: Partial<Record<LapiCapability, boolean>>): void {
    let changed = true;

    while (changed) {
        changed = false;

        for (const known of ALL_CAPABILITIES) {
            const supported = values[known];
            if (supported === undefined) {
                continue;
            }

            for (const candidate of ALL_CAPABILITIES) {
                if (values[candidate] !== undefined) {
                    continue;
                }

                const order = compareLapiVersions(CAPABILITY_MIN_VERSION[candidate], CAPABILITY_MIN_VERSION[known]);

                if ((supported && order <= 0) || (!supported && order >= 0)) {
                    values[candidate] = supported;
                    changed = true;
                }
            }
        }
    }
}

/**
 * Turn the known capabilities into a version range.
 *
 * A capability that works proves the LAPI is at least its minimum version; a
 * capability that fails proves it is older. The result is the smallest range
 * consistent with both, for example `>=1.6.9 <1.7.7`. Patch-level versions
 * inside the range cannot be told apart without a declared version.
 */
export function estimateLapiVersion(values: Partial<Record<LapiCapability, boolean>>, exactVersion?: string): LapiVersionEstimate {
    if (exactVersion) {
        return { exactVersion, minVersion: exactVersion, probable: exactVersion };
    }

    let minVersion: string | undefined;
    let belowVersion: string | undefined;

    for (const capability of ALL_CAPABILITIES) {
        const supported = values[capability];
        if (supported === undefined) {
            continue;
        }

        const version = CAPABILITY_MIN_VERSION[capability];

        if (supported) {
            if (!minVersion || compareLapiVersions(version, minVersion) > 0) {
                minVersion = version;
            }
        } else if (!belowVersion || compareLapiVersions(version, belowVersion) < 0) {
            belowVersion = version;
        }
    }

    // Inference should make this impossible; never return an empty range.
    if (minVersion && belowVersion && compareLapiVersions(minVersion, belowVersion) >= 0) {
        belowVersion = undefined;
    }

    const probable =
        minVersion && belowVersion
            ? `>=${minVersion} <${belowVersion}`
            : minVersion
              ? `>=${minVersion}`
              : belowVersion
                ? `<${belowVersion}`
                : 'unknown';

    return { minVersion, belowVersion, probable };
}

export class CapabilityContext implements CapabilityGuard {
    private state: LapiCapabilityState;
    private readonly strict: boolean;
    /** Capabilities explicitly probed; an explicit probe always wins. */
    private readonly probed = new Set<LapiCapability>();
    /** Capabilities observed on a real request, excluded from inference. */
    private readonly learned = new Set<LapiCapability>();

    public constructor(options: { version?: string; strict?: boolean } = {}) {
        this.strict = options.strict ?? false;
        this.state = { source: 'unknown', estimate: estimateLapiVersion({}), values: {} };

        if (options.version) {
            this.applyVersion(options.version);
        }
    }

    public applyVersion(version: string): void {
        const parsed = parseLapiVersion(version);
        if (!parsed) {
            throw new CrowdsecClientError(`invalid lapiVersion "${version}", expected a semver like 1.6.6`);
        }

        const values: Partial<Record<LapiCapability, boolean>> = {};
        for (const capability of ALL_CAPABILITIES) {
            values[capability] = compareLapiVersions(version, CAPABILITY_MIN_VERSION[capability]) >= 0;
        }

        this.probed.clear();
        this.learned.clear();

        this.state = { source: 'declared', version, estimate: estimateLapiVersion(values, version), values };
    }

    public applyProbes(observed: Partial<Record<LapiCapability, boolean>>): void {
        const values: Partial<Record<LapiCapability, boolean>> = { ...this.state.values };
        const learnedValues: Partial<Record<LapiCapability, boolean>> = {};

        // Learned values are observations from real requests, not version
        // probes: keep them out of the inference input. Re-added after
        // inference so they still answer `supports()`.
        for (const capability of this.learned) {
            if (values[capability] !== undefined) {
                learnedValues[capability] = values[capability];
            }
            delete values[capability];
        }

        let seen = false;
        for (const [capability, supported] of Object.entries(observed) as Array<[LapiCapability, boolean | undefined]>) {
            if (supported === undefined) {
                continue;
            }
            values[capability] = supported;
            this.learned.delete(capability);
            this.probed.add(capability);
            seen = true;
        }

        let version = this.state.version;
        if (version && !this.isConsistentWithVersion(values, version)) {
            // A probe contradicts the declared version: the declared-derived
            // values are not trustworthy, so rebuild from what was actually
            // observed instead of keeping an exact but wrong version.
            for (const capability of ALL_CAPABILITIES) {
                if (!this.probed.has(capability)) {
                    delete values[capability];
                }
            }
            version = undefined;
        }

        inferCapabilities(values);

        for (const [capability, supported] of Object.entries(learnedValues) as Array<[LapiCapability, boolean]>) {
            // A capability probed in this call left `learned` and was written
            // into `values`: the explicit probe wins over the stale observation.
            if (this.learned.has(capability)) {
                values[capability] = supported;
            }
        }

        this.state = {
            // A declared version stays authoritative while the probes agree
            // with it; a contradiction clears it and the state becomes probed.
            source: version ? 'declared' : seen ? 'probed' : this.state.source,
            version,
            estimate: this.estimate(values, version),
            values
        };
    }

    /**
     * Version estimate that ignores request-level observations: a single
     * rejected request must not advertise a lower LAPI version.
     */
    private estimate(values: Partial<Record<LapiCapability, boolean>>, version: string | undefined): LapiVersionEstimate {
        const inferable: Partial<Record<LapiCapability, boolean>> = { ...values };
        for (const capability of this.learned) {
            delete inferable[capability];
        }

        return estimateLapiVersion(inferable, version);
    }

    private isConsistentWithVersion(values: Partial<Record<LapiCapability, boolean>>, version: string): boolean {
        for (const capability of this.probed) {
            const supported = values[capability];
            if (supported === undefined) {
                continue;
            }

            const expected = compareLapiVersions(version, CAPABILITY_MIN_VERSION[capability]) >= 0;
            if (supported !== expected) {
                return false;
            }
        }

        return true;
    }

    public getCapabilities(): LapiCapabilityState {
        return {
            ...this.state,
            estimate: { ...this.state.estimate },
            values: { ...this.state.values }
        };
    }

    public supports(capability: LapiCapabilityInput): boolean | undefined {
        return this.state.values[toLapiCapability(capability)];
    }

    public learn(capability: LapiCapabilityInput, supported: boolean): void {
        const key = toLapiCapability(capability);

        // Declared and explicitly probed values are authoritative.
        if (this.state.source === 'declared' || this.probed.has(key)) {
            return;
        }

        // A value learned from a real request is not a deliberate version probe,
        // so it must not propagate to the other capabilities: a single rejected
        // filter (for example a 500 whose message matched the scope fallback)
        // would otherwise disable unrelated features such as heartbeat or
        // allowlists for the rest of the session. Mark it as learned even when
        // it corrects a value that was only inferred.
        const values: Partial<Record<LapiCapability, boolean>> = { ...this.state.values, [key]: supported };
        this.learned.add(key);
        this.state = {
            // Keep the stronger provenance: one observation must not downgrade
            // a state where the other values come from probes.
            source: this.state.source === 'probed' ? 'probed' : 'observed',
            version: this.state.version,
            estimate: this.estimate(values, this.state.version),
            values
        };
    }

    public assertSupport(capability: LapiCapabilityInput): void {
        const key = toLapiCapability(capability);
        const supported = this.supports(key);

        if (supported === true) {
            return;
        }

        if (supported === false) {
            throw new FeatureNotSupportedError(key, CAPABILITY_MIN_VERSION[key], this.state.version);
        }

        if (this.strict) {
            throw new LapiVersionUnknownError(key, CAPABILITY_MIN_VERSION[key]);
        }
    }
}

/**
 * Interpret the HTTP status of a probe request.
 *
 * Filter probes: 2xx means supported, 500 means the parameter is unknown, and
 * anything else (400, 401, 403) is inconclusive. Route probes: 404 means the
 * endpoint does not exist, and any other status below 500 means it exists
 * (400 for a rejected empty body, 403 for a credential type that does not apply
 * to the probe). For route probes, a 401 is inconclusive: it only says the
 * caller is not authenticated, so it must not be read as proof that the route
 * exists.
 */
export function interpretProbe(capability: LapiCapabilityInput, status: number | undefined): boolean | undefined {
    const key = toLapiCapability(capability);

    if (status === undefined) {
        return undefined;
    }

    if (status === 404) {
        return false;
    }

    // On 1.6.6-1.6.8 the bulk route is missing, but Gin answers 405 because the
    // path shares a prefix with the single-value check route.
    if (key === LapiCapability.allowlistsBulkCheck && status === 405) {
        return false;
    }

    const filterLike =
        key === LapiCapability.containsFilter ||
        key === LapiCapability.alertOriginFilter ||
        key === LapiCapability.decisionOriginsFilter ||
        key === LapiCapability.alertKindFilter;

    if (filterLike) {
        if (status >= 200 && status < 300) {
            return true;
        }
        if (status === 500) {
            return false;
        }
        return undefined;
    }

    // A 401 means the caller is not authenticated: it proves nothing about the
    // route, so an unauthenticated probe must not report every endpoint as
    // supported. A 403 (wrong credential type for an existing route) does prove
    // the route exists.
    if (status === 401) {
        return undefined;
    }

    if (status >= 200 && status < 500) {
        return true;
    }

    return undefined;
}
