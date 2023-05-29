import { EErrorsCodes } from './EErrorsCodes.js';

export class __Error implements Error {
    public stack: string;
    protected _message: string;
    /**
     * can also contain error like certificates error (https://nodejs.org/api/tls.html#tls_x509_certificate_error_codes) or other errors . Can be a string, or a number
     */
    public errorCode: EErrorsCodes;
    /**
     * can also contain error like certificates error (https://nodejs.org/api/tls.html#tls_x509_certificate_error_codes) or other errors . Can be a string, or a number
     */
    public code: EErrorsCodes;
    public exception: Error;
    public message: string;

    public constructor(message: string | Error = '', code: EErrorsCodes = EErrorsCodes.UNKNOWN_ERROR, exception?: Error | string | null) {
        if (message instanceof Error) {
            exception = message;
            message = message.message;
        }

        this.errorCode = code;
        this.code = code;

        const generateStack = (): string => {
            let tmpStack = new Error().stack || '';
            if (this.exception) {
                tmpStack += '\n=== CAUSED BY ===\n';
                tmpStack += `${this.exception.toString()}`;
            }
            //remove two last line from stack
            return `${this.name} : ${this._message}\n${tmpStack}`;
        };

        this._message = message;
        this.message = this._message;
        this.exception = typeof exception === typeof '' ? new Error(exception as string) : (exception as Error);

        this.stack = generateStack();
    }

    public toString = (): string => {
        const obj = Object(this);
        if (obj !== this) {
            throw new TypeError();
        }

        const name = this.name || 'Error';

        const message = String(this._message) || '';

        const strComponents: Array<string> = [];

        const errorCodeStr = this.errorCode ? ` (${this.errorCode})` : '';

        strComponents.push(`${name}${errorCodeStr} : ${message} \n`);

        strComponents.push(this.stack);

        return strComponents.join(' ');
    };

    name: string = 'Error';
}
