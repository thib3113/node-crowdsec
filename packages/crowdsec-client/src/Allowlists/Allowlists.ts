import { BaseSubObject } from '../BaseSubObject.js';
import { CAPABILITY_MIN_VERSION, LapiCapability } from '../Capabilities.js';
import { FeatureNotSupportedError } from '../Errors/FeatureNotSupportedError.js';
import type { Allowlists as AllowlistsTypes } from '../types/index.js';
import type { AxiosResponse } from 'axios';

/** A missing route: 404 on older LAPIs, 405 on 1.6.6-1.6.8 (shared prefix). */
function isRouteUnavailable(error: unknown): boolean {
    const candidate = error as { code?: unknown; response?: { status?: unknown } } | undefined;
    // Wrapped errors carry the numeric status in `code`; a raw AxiosError uses a
    // string `code` and keeps the status in `response.status`.
    const status = typeof candidate?.code === 'number' ? candidate.code : candidate?.response?.status;
    return status === 404 || status === 405;
}

export class Allowlists extends BaseSubObject {
    /**
     * List allowlists.
     * @since CrowdSec 1.6.6
     * @throws {FeatureNotSupportedError} when the connected LAPI is older than 1.6.6.
     */
    public async list(withContent: boolean = true): Promise<AllowlistsTypes.GetAllowlists.ResponseBody> {
        this.requireCapability(LapiCapability.allowlists);

        return (
            await this.http.get<
                AllowlistsTypes.GetAllowlists.ResponseBody,
                AxiosResponse<AllowlistsTypes.GetAllowlists.ResponseBody>,
                AllowlistsTypes.GetAllowlists.RequestQuery
            >('/v1/allowlists', {
                params: { with_content: withContent }
            })
        ).data;
    }

    /**
     * Get a single allowlist.
     * @since CrowdSec 1.6.6
     * @throws {FeatureNotSupportedError} when the connected LAPI is older than 1.6.6.
     */
    public async get(name: string, withContent: boolean = true): Promise<AllowlistsTypes.GetAllowlist.ResponseBody> {
        this.requireCapability(LapiCapability.allowlists);

        return (
            await this.http.get<
                AllowlistsTypes.GetAllowlist.ResponseBody,
                AxiosResponse<AllowlistsTypes.GetAllowlist.ResponseBody>,
                AllowlistsTypes.GetAllowlist.RequestQuery
            >(`/v1/allowlists/${encodeURIComponent(name)}`, {
                params: { with_content: withContent }
            })
        ).data;
    }

    /**
     * Check whether a single value is allowlisted.
     * @since CrowdSec 1.6.6
     * @throws {FeatureNotSupportedError} when the connected LAPI is older than 1.6.6.
     */
    public async check(value: string): Promise<AllowlistsTypes.CheckAllowlist.ResponseBody> {
        this.requireCapability(LapiCapability.allowlists);

        return (
            await this.http.get<
                AllowlistsTypes.CheckAllowlist.ResponseBody,
                AxiosResponse<AllowlistsTypes.CheckAllowlist.ResponseBody>,
                AllowlistsTypes.CheckAllowlist.RequestQuery
            >(`/v1/allowlists/check/${encodeURIComponent(value)}`)
        ).data;
    }

    /**
     * Check several values against the allowlists in one request.
     * @since CrowdSec 1.6.9
     * @remarks On 1.6.6 to 1.6.8, falls back to {@link check} per value.
     * @throws {FeatureNotSupportedError} when the connected LAPI is older than 1.6.6.
     */
    public async bulkCheck(targets: string[]): Promise<AllowlistsTypes.PostCheckAllowlist.ResponseBody> {
        // On 1.6.6-1.6.8 the bulk route is missing (405). When the capability
        // is already known to be absent, skip the doomed request.
        if (this.capabilities?.supports(LapiCapability.allowlistsBulkCheck) === false) {
            return this.bulkCheckFallback(targets);
        }

        this.requireCapability(LapiCapability.allowlistsBulkCheck);

        try {
            return await this.bulkCheckRequest(targets);
        } catch (error) {
            if (!isRouteUnavailable(error)) {
                throw error;
            }

            this.capabilities?.learn(LapiCapability.allowlistsBulkCheck, false);
            return this.bulkCheckFallback(targets);
        }
    }

    private async bulkCheckRequest(targets: string[]): Promise<AllowlistsTypes.PostCheckAllowlist.ResponseBody> {
        return (
            await this.http.post<
                AllowlistsTypes.PostCheckAllowlist.ResponseBody,
                AxiosResponse<AllowlistsTypes.PostCheckAllowlist.ResponseBody>,
                AllowlistsTypes.PostCheckAllowlist.RequestBody
            >('/v1/allowlists/check', { targets })
        ).data;
    }

    private async bulkCheckFallback(targets: string[]): Promise<AllowlistsTypes.PostCheckAllowlist.ResponseBody> {
        const results: AllowlistsTypes.PostCheckAllowlist.ResponseBody['results'] = [];

        for (const target of targets) {
            let checked: AllowlistsTypes.CheckAllowlist.ResponseBody;
            try {
                checked = await this.check(target);
            } catch (error) {
                if (isRouteUnavailable(error)) {
                    throw new FeatureNotSupportedError(LapiCapability.allowlists, CAPABILITY_MIN_VERSION[LapiCapability.allowlists]);
                }
                throw error;
            }

            if (checked.allowlisted) {
                // The single-value route only exposes the matched item (`reason`),
                // not the allowlist name and comment returned by the bulk route.
                // Label it explicitly so callers do not mistake the matched item
                // for an allowlist name.
                results.push({ target, allowlists: [`unknown allowlist (matched item: ${checked.reason ?? target})`] });
            }
        }

        return { results };
    }
}
