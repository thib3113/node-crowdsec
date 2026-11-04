import type { LapiCapability } from '../Capabilities.js';
import { CrowdsecClientError } from './CrowdsecClientError.js';
import { EErrorsCodes } from './EErrorsCodes.js';

/**
 * Raised when a method requires a CrowdSec LAPI capability the connected
 * server does not provide.
 */
export class FeatureNotSupportedError extends CrowdsecClientError {
    public readonly capability: LapiCapability;
    public readonly minimumVersion: string;
    public readonly detectedVersion?: string;

    public constructor(capability: LapiCapability, minimumVersion: string, detectedVersion?: string) {
        const detected = detectedVersion ? ` (detected ${detectedVersion})` : '';
        super(
            `This feature requires CrowdSec LAPI ${minimumVersion} or newer${detected}: capability "${capability}" is not supported.`,
            EErrorsCodes.FEATURE_NOT_SUPPORTED
        );

        this.name = 'FeatureNotSupportedError';
        this.capability = capability;
        this.minimumVersion = minimumVersion;
        this.detectedVersion = detectedVersion;
    }
}
