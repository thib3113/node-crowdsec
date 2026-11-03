import { BaseSubObject } from '../BaseSubObject.js';
import { LapiCapability } from '../Capabilities.js';
import type { Decisions, DeleteDecisionsQuery } from '../types/index.js';
import { withContainsDefault } from '../utils.js';
import type { AxiosResponse } from 'axios';

function httpStatus(error: unknown): unknown {
    const candidate = error as { code?: unknown; response?: { status?: unknown } } | undefined;
    // Wrapped errors carry the numeric HTTP status in `code`; a raw AxiosError
    // uses a string `code` and keeps the status in `response.status`.
    return typeof candidate?.code === 'number' ? candidate.code : candidate?.response?.status;
}

function isUnknownFilter(error: unknown, parameter: 'scope' | 'scopes'): boolean {
    const candidate = error as { message?: unknown };

    if (httpStatus(error) !== 500 || typeof candidate?.message !== 'string') {
        return false;
    }

    // The message format is not stable across releases: 1.8.x answers
    // "'scope' doesn't exist: invalid filter", older versions use variants
    // such as "unknown filter parameter 'scope'". Match the parameter name
    // together with any of the documented rejection wordings instead of a
    // single sentence.
    const mentionsParameter = new RegExp(`\\b${parameter}\\b`, 'i').test(candidate.message);
    if (!mentionsParameter) {
        return false;
    }

    return /(doesn'?t exist|unknown|invalid)[\s\S]{0,60}filter|filter[\s\S]{0,60}(doesn'?t exist|unknown|invalid)/i.test(candidate.message);
}

function withScopeParameter(options: DeleteDecisionsQuery, parameter: 'scope' | 'scopes', value: string): DeleteDecisionsQuery {
    const query: DeleteDecisionsQuery = { ...options };
    delete query.scope;
    delete query.scopes;
    query[parameter] = value;
    return query;
}

export class DecisionsWatcher extends BaseSubObject {
    public async deleteById(id: string): Promise<Decisions.DeleteDecision.ResponseBody> {
        return (await this.http.delete(`/v1/decisions/${encodeURIComponent(id)}`)).data;
    }

    /**
     * Delete decisions matching a filter.
     * @since CrowdSec 1.0.0
     * @remarks
     * - `contains` requires CrowdSec LAPI 1.0.3. It is set to `false`
     *   automatically when `ip`/`range` is used, unless the caller overrides it.
     * - `scenario` requires CrowdSec LAPI 1.4.2.
     * - The LAPI delete filter uses `scope` before 1.3.3 and `scopes` from
     *   1.3.3. The client uses the known capability, or tries `scopes` and
     *   falls back to `scope` on the specific "invalid filter" 500, then
     *   remembers the result for the next calls.
     * @throws {FeatureNotSupportedError} when a used filter is not supported by the connected LAPI.
     */
    public async delete(rawOptions: DeleteDecisionsQuery): Promise<Decisions.DeleteDecisions.ResponseBody> {
        const options = withContainsDefault(rawOptions);

        if (options.contains !== undefined) {
            this.requireCapability(LapiCapability.containsFilter);
        }
        if (options.scenario !== undefined) {
            this.requireCapability(LapiCapability.decisionScenarioDelete);
        }

        const requestedScope = options.scopes ?? options.scope;
        if (requestedScope === undefined) {
            return this.send(options);
        }

        const supported = this.capabilities?.supports(LapiCapability.decisionScopesDelete);
        const preferred = supported === false ? 'scope' : 'scopes';
        const alternate = preferred === 'scopes' ? 'scope' : 'scopes';

        try {
            const result = await this.send(withScopeParameter(options, preferred, requestedScope));
            this.capabilities?.learn(LapiCapability.decisionScopesDelete, preferred === 'scopes');
            return result;
        } catch (error) {
            if (!isUnknownFilter(error, preferred)) {
                throw error;
            }

            // The failure happened while parsing the filter, before any query
            // executed, so retrying with the other parameter name is safe.
            const result = await this.send(withScopeParameter(options, alternate, requestedScope));
            this.capabilities?.learn(LapiCapability.decisionScopesDelete, alternate === 'scopes');
            return result;
        }
    }

    private async send(options: DeleteDecisionsQuery): Promise<Decisions.DeleteDecisions.ResponseBody> {
        return (
            await this.http.delete<
                Decisions.DeleteDecisions.ResponseBody,
                AxiosResponse<Decisions.DeleteDecisions.ResponseBody>,
                Decisions.DeleteDecisions.RequestQuery
            >('/v1/decisions', {
                params: options
            })
        ).data;
    }
}
