import { __Error } from './__Error.js';
import { AxiosError } from './AxiosError.js';

export class CrowdSecServerError extends __Error {
    public axiosError?: AxiosError;

    public constructor(message: string | Error = '', code = 0, errors = '', exception?: AxiosError) {
        super(message, code, exception);
        //just in case framework try to read message directly
        this._message = this._message + (errors ? `(${errors})` : '');
        this.message = this._message;
        // Set the prototype explicitly.
        // Object.setPrototypeOf(this, Error.prototype);
        this.axiosError = exception;
    }

    name: string = 'CrowdSecError';
}
