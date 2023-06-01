import { __Error } from './__Error.js';
import { EErrorsCodes } from './EErrorsCodes.js';

export class CrowdsecClientError extends __Error {
    public constructor(message: string | Error = '', code: EErrorsCodes = EErrorsCodes.UNKNOWN_ERROR, exception?: Error) {
        super(message, code, exception);
    }
}
