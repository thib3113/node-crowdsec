import { ICrowdSecClientOptions } from './ICrowdSecClientOptions.js';

export interface IWatcherClientOptions extends ICrowdSecClientOptions {
    auth: {
        machineID: string;
        password: string;
        autoRenew?: boolean;
    };
}
