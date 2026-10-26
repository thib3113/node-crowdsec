import { BaseSubObject } from '../BaseSubObject.js';
import type { Allowlists as AllowlistsTypes } from '../types/index.js';
import type { AxiosResponse } from 'axios';

export class Allowlists extends BaseSubObject {
    public async list(withContent: boolean = true): Promise<AllowlistsTypes.GetAllowlists.ResponseBody> {
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

    public async get(name: string, withContent: boolean = true): Promise<AllowlistsTypes.GetAllowlist.ResponseBody> {
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

    public async check(value: string): Promise<AllowlistsTypes.CheckAllowlist.ResponseBody> {
        return (
            await this.http.get<
                AllowlistsTypes.CheckAllowlist.ResponseBody,
                AxiosResponse<AllowlistsTypes.CheckAllowlist.ResponseBody>,
                AllowlistsTypes.CheckAllowlist.RequestQuery
            >(`/v1/allowlists/check/${encodeURIComponent(value)}`)
        ).data;
    }

    public async bulkCheck(targets: string[]): Promise<AllowlistsTypes.PostCheckAllowlist.ResponseBody> {
        return (
            await this.http.post<
                AllowlistsTypes.PostCheckAllowlist.ResponseBody,
                AxiosResponse<AllowlistsTypes.PostCheckAllowlist.ResponseBody>,
                AllowlistsTypes.PostCheckAllowlist.RequestBody
            >('/v1/allowlists/check', { targets })
        ).data;
    }
}
