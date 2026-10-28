import { BaseSubObject } from '../BaseSubObject.js';
import { Alerts as AlertsTypes } from '../types/index.js';
import type { DeleteAlertsQuery, SearchAlertsQuery } from '../types/index.js';
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

    public async search(options?: SearchAlertsQuery): Promise<AlertsTypes.SearchAlerts.ResponseBody> {
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
                `/v1/alerts/${id}`
            )
        ).data;
    }

    public async delete(options: DeleteAlertsQuery): Promise<AlertsTypes.DeleteAlerts.ResponseBody> {
        return (
            await this.http.delete<
                AlertsTypes.DeleteAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.DeleteAlerts.ResponseBody>,
                AlertsTypes.DeleteAlerts.RequestQuery
            >('/v1/alerts', {
                params: options
            })
        ).data;
    }

    public async deleteById(id: string): Promise<AlertsTypes.DeleteAlerts.ResponseBody> {
        return (await this.http.delete<AlertsTypes.DeleteAlerts.ResponseBody>(`/v1/alerts/${id}`)).data;
    }
}
