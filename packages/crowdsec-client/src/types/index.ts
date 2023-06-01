export * from './generated/AlertsRoute.js';
export * from './generated/data-contracts.js';
export * from './generated/DecisionsRoute.js';
export * from './generated/WatchersRoute.js';

export type decisionOrigin = 'capi' | 'crowdsec' | 'cscli' | 'console' | 'cscli-import' | 'lists' | string;
export type decisionType = 'ban' | 'captcha' | string;
