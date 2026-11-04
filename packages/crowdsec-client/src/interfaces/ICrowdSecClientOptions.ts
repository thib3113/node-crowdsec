import { IHTTPOptions } from './IHTTPOptions.js';

export interface ICrowdSecClientOptions extends IHTTPOptions {
    /**
     * CrowdSec LAPI version the client talks to (for example `1.6.6`).
     * When set, capabilities are resolved locally without probing.
     */
    lapiVersion?: string;
    /**
     * Probe the LAPI after login to discover the supported capabilities.
     * Ignored when `lapiVersion` is set.
     *
     * @default false
     */
    detectCapabilities?: boolean;
    /**
     * Throw when a capability is known to be unsupported, or when it cannot be
     * verified. Without it, unverified capabilities are attempted optimistically.
     *
     * @default false
     */
    strictCapabilities?: boolean;
}
