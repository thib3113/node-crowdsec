import { AxiosInstance } from 'axios';

export interface IBaseSubObjectOptions {
    httpClient: AxiosInstance;
}

export class BaseSubObject {
    protected http: AxiosInstance;
    constructor(options: IBaseSubObjectOptions) {
        this.http = options.httpClient;
    }
}
