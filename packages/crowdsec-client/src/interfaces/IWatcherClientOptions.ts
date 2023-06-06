import { ICrowdSecClientOptions } from './ICrowdSecClientOptions.js';
import { ITLSAuthentication } from './ITLSAuthentication.js';
import { IWatcherAuthentication } from './IWatcherAuthentication.js';

export interface IWatcherClientOptions extends ICrowdSecClientOptions {
    auth: IWatcherAuthentication | ITLSAuthentication;
    /**
     * send heartbeat periodically
     * pass number to specify ms between call
     */
    heartbeat?: boolean | number;
}
