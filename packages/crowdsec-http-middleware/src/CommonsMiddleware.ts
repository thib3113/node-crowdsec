import { logger, loggerOption } from './ICrowdSecHTTPMiddlewareOptions.js';
import { createDebugger } from './utils.js';

export class CommonsMiddleware {
    protected logger: Required<logger>;

    constructor(name: string, options?: loggerOption) {
        this.logger = this.getLogger(name, options);
    }

    getLogger(name: string, options?: loggerOption, extendedName?: string): Required<logger> {
        const defaultExtend = (extendName: string) => this.getLogger(name, options, extendName);
        if (!options) {
            const _debug = createDebugger(name);
            const debug = extendedName ? _debug.extend(extendedName) : _debug;
            return {
                warn: (...args) => debug('warning : %s', ...args),
                debug: debug,
                info: debug,
                error: (...args) => debug('error : %s', ...args),
                extend: defaultExtend
            };
        }

        if (typeof options === 'function') {
            return {
                extend: defaultExtend,
                ...options(name)
            };
        }

        return {
            extend: defaultExtend,
            ...options
        };
    }
}
