import { ICrowdSecClientOptions } from './ICrowdSecClientOptions.js';

export interface IBouncerClientOptions extends ICrowdSecClientOptions {
    auth: {
        apiKey: string;
    };
}
