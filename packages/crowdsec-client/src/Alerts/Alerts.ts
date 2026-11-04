import { BaseSubObject } from '../BaseSubObject.js';
import { LapiCapability } from '../Capabilities.js';
import { Alerts as AlertsTypes } from '../types/index.js';
import type { DeleteAlertsQuery, SearchAlertsQuery } from '../types/index.js';
import { withContainsDefault } from '../utils.js';
import { AxiosResponse } from 'axios';

export class Alerts extends BaseSubObject {
    /**
     * Create Alerts and return the IDs
     * @param datas
     */
    public async pushAlerts(datas: AlertsTypes.PushAlerts.RequestBody): Promise<AlertsTypes.PushAlerts.ResponseBody> {
        return (
            await this.http.post<
                AlertsTypes.PushAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.PushAlerts.ResponseBody>,
                AlertsTypes.PushAlerts.RequestBody
            >('/v1/alerts', datas)
        ).data;
    }

    /**
     * Search alerts.
     * @since CrowdSec 1.0.0
     * @remarks
     * - `contains` requires CrowdSec LAPI 1.0.3.
     * - `origin` requires CrowdSec LAPI 1.3.0.
     * - `kind` requires CrowdSec LAPI 1.7.7.
     * @throws {FeatureNotSupportedError} when a used filter is not supported by the connected LAPI.
     */
    public async search(options?: SearchAlertsQuery): Promise<AlertsTypes.SearchAlerts.ResponseBody> {
        if (options?.contains !== undefined) {
            this.requireCapability(LapiCapability.containsFilter);
        }
        if (options?.origin !== undefined) {
            this.requireCapability(LapiCapability.alertOriginFilter);
        }
        if (options?.kind !== undefined) {
            this.requireCapability(LapiCapability.alertKindFilter);
        }

        return (
            await this.http.get<
                AlertsTypes.SearchAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.SearchAlerts.ResponseBody>,
                AlertsTypes.SearchAlerts.RequestQuery
            >('/v1/alerts', {
                params: options
            })
        ).data;
    }

    public async getById(id: string): Promise<AlertsTypes.GetAlertbyId.ResponseBody> {
        return (
            await this.http.get<AlertsTypes.GetAlertbyId.ResponseBody, AxiosResponse<AlertsTypes.GetAlertbyId.ResponseBody>>(
                `/v1/alerts/${encodeURIComponent(id)}`
            )
        ).data;
    }

    /**
     * Delete alerts matching a filter.
     * @since CrowdSec 1.0.0
     * @remarks
     * - `contains` requires CrowdSec LAPI 1.0.3.
     * - `origin` requires CrowdSec LAPI 1.3.0.
     * - `kind` requires CrowdSec LAPI 1.7.7.
     * - Alert deletion from a remote host requires the LAPI host to trust the caller (otherwise HTTP 403).
     * @throws {FeatureNotSupportedError} when a used filter is not supported by the connected LAPI.
     */
    public async delete(options: DeleteAlertsQuery): Promise<AlertsTypes.DeleteAlerts.ResponseBody> {
        const normalized = withContainsDefault(options);

        if (normalized.contains !== undefined) {
            this.requireCapability(LapiCapability.containsFilter);
        }
        if (normalized.origin !== undefined) {
            this.requireCapability(LapiCapability.alertOriginFilter);
        }
        if (normalized.kind !== undefined) {
            this.requireCapability(LapiCapability.alertKindFilter);
        }

        return (
            await this.http.delete<
                AlertsTypes.DeleteAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.DeleteAlerts.ResponseBody>,
                AlertsTypes.DeleteAlerts.RequestQuery
            >('/v1/alerts', {
                params: normalized
            })
        ).data;
    }

    /**
     * Delete a single alert by id.
     * @since CrowdSec 1.4.2
     * @remarks Alert deletion from a remote host requires the LAPI host to trust the caller (otherwise HTTP 403).
     * @throws {FeatureNotSupportedError} when the connected LAPI is older than 1.4.2.
     */
    public async deleteById(id: string): Promise<AlertsTypes.DeleteAlerts.ResponseBody> {
        this.requireCapability(LapiCapability.alertDeleteById);
        return (await this.http.delete<AlertsTypes.DeleteAlerts.ResponseBody>(`/v1/alerts/${encodeURIComponent(id)}`)).data;
    }
}
