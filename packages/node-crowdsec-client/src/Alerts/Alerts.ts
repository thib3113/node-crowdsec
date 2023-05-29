import { BaseSubObject } from '../BaseSubObject.js';
import { Alerts as AlertsTypes } from 'crowdsec-types';
import { AxiosResponse } from 'axios';

export class Alerts extends BaseSubObject {
    public async pushAlerts(datas: AlertsTypes.PushAlerts.RequestBody): Promise<AlertsTypes.PushAlerts.ResponseBody> {
        return (
            await this.http.post<
                AlertsTypes.PushAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.PushAlerts.ResponseBody>,
                AlertsTypes.PushAlerts.RequestBody
            >('/v1/alerts', datas)
        ).data;
    }

    public async search(options: AlertsTypes.SearchAlerts.RequestQuery): Promise<AlertsTypes.SearchAlerts.ResponseBody> {
        return (
            await this.http.get<
                AlertsTypes.SearchAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.SearchAlerts.ResponseBody>,
                AlertsTypes.SearchAlerts.RequestQuery
            >('/v1/alerts', {
                data: options
            })
        ).data;
    }

    public async getById(id: string): Promise<AlertsTypes.SearchAlerts.ResponseBody> {
        return (
            await this.http.get<
                AlertsTypes.SearchAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.SearchAlerts.ResponseBody>,
                AlertsTypes.SearchAlerts.RequestQuery
            >(`/v1/alerts/${id}`)
        ).data;
    }

    public async delete(options: AlertsTypes.DeleteAlerts.RequestQuery): Promise<AlertsTypes.DeleteAlerts.ResponseBody> {
        return (
            await this.http.delete<
                AlertsTypes.DeleteAlerts.ResponseBody,
                AxiosResponse<AlertsTypes.DeleteAlerts.ResponseBody>,
                AlertsTypes.DeleteAlerts.RequestQuery
            >('/v1/alerts', {
                data: options
            })
        ).data;
    }

    public async deleteById(id: string): Promise<AlertsTypes.DeleteAlerts.ResponseBody> {
        return (await this.http.delete<AlertsTypes.DeleteAlerts.ResponseBody>(`/v1/alerts/${id}`)).data;
    }
}
