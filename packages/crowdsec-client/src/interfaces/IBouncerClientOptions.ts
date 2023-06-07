import { ICrowdSecClientOptions } from './ICrowdSecClientOptions.js';
import { ITLSAuthentication } from './ITLSAuthentication.js';
import { IBouncerAuthentication } from './IBouncerAuthentication.js';

export interface IBouncerClientOptions extends ICrowdSecClientOptions {
    auth: IBouncerAuthentication | ITLSAuthentication;
}
