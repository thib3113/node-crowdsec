import type { LapiCapability } from '../Capabilities.js';
import { CrowdsecClientError } from './CrowdsecClientError.js';
import { EErrorsCodes } from './EErrorsCodes.js';

/**
 * Raised in strict mode when the client could not determine whether the
 * connected LAPI supports a capability.
 */
export class LapiVersionUnknownError extends CrowdsecClientError {
    public readonly capability: LapiCapability;
    public readonly minimumVersion: string;

    public constructor(capability: LapiCapability, minimumVersion: string) {
        super(
            `Cannot verify that the CrowdSec LAPI supports "${capability}" (requires ${minimumVersion} or newer). ` +
                'Declare `lapiVersion`, enable `detectCapabilities`, or disable `strictCapabilities`.',
            EErrorsCodes.LAPI_VERSION_UNKNOWN
        );

        this.name = 'LapiVersionUnknownError';
        this.capability = capability;
        this.minimumVersion = minimumVersion;
    }
}
