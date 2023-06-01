import { ICrowdSecClientOptions } from './ICrowdSecClientOptions.js';

export interface IWatcherClientOptions extends ICrowdSecClientOptions {
    auth: {
        machineID: string;
        password: string;
        autoRenew?: boolean;
    };
    /**
     * send heartbeat periodically
     * pass number to specify ms between call
     */
    heartbeat?: boolean | number;
}
