import { AxiosInstance } from 'axios';
import type { CapabilityGuard, LapiCapabilityInput } from './Capabilities.js';

export interface IBaseSubObjectOptions {
    httpClient: AxiosInstance;
    capabilities?: CapabilityGuard;
}

export class BaseSubObject {
    protected http: AxiosInstance;
    protected capabilities?: CapabilityGuard;

    constructor(options: IBaseSubObjectOptions) {
        this.http = options.httpClient;
        this.capabilities = options.capabilities;
    }

    protected requireCapability(capability: LapiCapabilityInput): void {
        this.capabilities?.assertSupport(capability);
    }
}
