import { BaseSubObject } from '../BaseSubObject.js';
import { Decisions } from 'crowdsec-types';
import { AxiosResponse } from 'axios';

export class DecisionsWatcher extends BaseSubObject {
    public async deleteById(id: string): Promise<Decisions.DeleteDecision.ResponseBody> {
        return (await this.http.delete(`/v1/decisions/${id}`)).data;
    }
    public async delete(options: Decisions.DeleteDecisions.RequestQuery): Promise<Decisions.DeleteDecisions.ResponseBody> {
        return (
            await this.http.delete<
                Decisions.DeleteDecisions.ResponseBody,
                AxiosResponse<Decisions.DeleteDecisions.ResponseBody>,
                Decisions.DeleteDecisions.RequestQuery
            >(`/v1/decisions/`, {
                data: options
            })
        ).data;
    }
}
