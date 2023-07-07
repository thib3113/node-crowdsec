import { pkg } from './pkg.js';
import { IScenario } from './baseScenarios/IScenario.js';
import { XForwardedForChecker, AllowListEnrich } from './scenarios/index.js';

export * from './baseScenarios/index.js';
export * from './scenarios/index.js';

export const scenarios: Array<IScenario> = [AllowListEnrich, XForwardedForChecker];

export const VERSION = pkg.version;
