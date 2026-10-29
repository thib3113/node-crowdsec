import type { GoDuration } from '../duration.js';
import type { Alerts } from './generated/AlertsRoute.js';

export type { GoDuration } from '../duration.js';

/**
 * `contains` and `kind` are supported by the LAPI alert filter but missing from
 * the generated swagger type.
 *
 * @see https://github.com/crowdsecurity/crowdsec/blob/909b5157986a2b2c2163300fdaef5ed01289f7d2/pkg/database/alertfilter.go
 */
export type SearchAlertsQuery = Omit<Alerts.SearchAlerts.RequestQuery, 'since' | 'until'> & {
    since?: GoDuration;
    until?: GoDuration;
    contains?: boolean;
    kind?: string;
};

/**
 * The upstream swagger documents `since`/`until` as timestamps, but the LAPI
 * parses them as Go durations for both the alert search and the alert delete.
 *
 * `decision_type`, `kind` and `contains` are supported by the same filter but
 * missing from the generated swagger type.
 *
 * @see https://github.com/crowdsecurity/crowdsec/blob/909b5157986a2b2c2163300fdaef5ed01289f7d2/pkg/database/alertfilter.go#L44-L67
 */
export type DeleteAlertsQuery = Omit<Alerts.DeleteAlerts.RequestQuery, 'since' | 'until'> & {
    since?: GoDuration;
    until?: GoDuration;
    decision_type?: string;
    kind?: string;
    contains?: boolean;
};
