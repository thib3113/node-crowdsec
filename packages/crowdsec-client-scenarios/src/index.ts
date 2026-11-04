import { pkg } from './pkg.js';
import { IScenarioConstructor } from './baseScenarios/IScenario.js';
import { AllowListEnricher, HTTPEnricher, XForwardedForChecker } from './scenarios/index.js';

export * from './baseScenarios/index.js';
export * from './scenarios/index.js';

export const scenarios: Array<IScenarioConstructor> = [AllowListEnricher, XForwardedForChecker, HTTPEnricher];

export const VERSION = pkg.version;
