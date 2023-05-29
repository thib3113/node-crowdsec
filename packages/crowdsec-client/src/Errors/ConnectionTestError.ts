import { __Error } from './__Error.js';
import { AxiosError } from 'axios';
import { EErrorsCodes } from './EErrorsCodes.js';

export class ConnectionTestError extends __Error {
    public constructor(message: string | Error = '', code: EErrorsCodes = EErrorsCodes.UNKNOWN_ERROR, exception?: AxiosError) {
        super(message, code, exception);
    }
}
