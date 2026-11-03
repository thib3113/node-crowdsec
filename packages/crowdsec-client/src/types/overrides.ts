import type { GoDuration } from '../duration.js';
import type { Alerts } from './generated/AlertsRoute.js';
import type { Decisions } from './generated/DecisionsRoute.js';

export type { GoDuration } from '../duration.js';

/**
 * `contains` and `kind` are supported by the LAPI alert filter but missing from
 * the generated swagger type.
 *
 * Validated against CrowdSec 1.8.1 (Docker, `alertfilter.go`):
 * - `ip`/`range` match alerts through their decisions, so alerts without
 *   decisions never match those filters.
 * - `contains` defaults to true at the LAPI level: true = decision range
 *   contains the value, false = decision range is contained within the value.
 *   `Alerts.delete`/`Decisions.delete` make it explicit (`false`) when
 *   `ip`/`range` is set, unless the caller passes `contains`.
 * - `kind` is case-sensitive (`WAF` matches nothing); `origin` filters the
 *   origin of the decisions attached to the alert, not the alert kind.
 * - An unknown `kind`/`origin` returns an empty list, not an error.
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
 * `decision_type`, `kind`, `contains` and `origin` are supported by the same
 * filter but missing from (or wrong in) the generated swagger type.
 *
 * Validated against CrowdSec 1.8.1 (Docker):
 * - `DELETE /v1/alerts?alert_source=...` -> 500 `filter parameter
 *   'alert_source' is unknown`.
 * - `DELETE /v1/alerts?origin=...`, `kind=...`, `contains=...` and
 *   `decision_type=...` are accepted.
 *
 * @see https://github.com/crowdsecurity/crowdsec/blob/909b5157986a2b2c2163300fdaef5ed01289f7d2/pkg/database/alertfilter.go#L44-L67
 */
export type DeleteAlertsQuery = Omit<Alerts.DeleteAlerts.RequestQuery, 'since' | 'until' | 'alert_source'> & {
    /** @deprecated Rejected by LAPI 1.8.1; use `origin`. */
    alert_source?: string;
    since?: GoDuration;
    until?: GoDuration;
    decision_type?: string;
    kind?: string;
    contains?: boolean;
    origin?: string;
};

/**
 * Decision delete filters.
 *
 * Validated against CrowdSec 1.8.1 (Docker):
 * - `DELETE /v1/decisions?scope=Country` -> 500 `'scope' doesn't exist:
 *   invalid filter`; `scopes=Country` is accepted.
 * - `contains` is supported and defaults to true. Omitting it on an IP delete
 *   also expires every Range decision that contains the IP; `contains=false`
 *   restricts the delete to decisions contained within the value.
 *   `Decisions.delete` applies `contains:false` automatically for `ip`/`range`
 *   unless the caller overrides it.
 *
 * @see https://github.com/crowdsecurity/crowdsec/blob/v1.8.1/pkg/database/decisions.go
 */
export type DeleteDecisionsQuery = Omit<Decisions.DeleteDecisions.RequestQuery, 'scope'> & {
    /** @deprecated Rejected by LAPI 1.8.1 (`'scope' doesn't exist`); use `scopes`. */
    scope?: string;
    /**
     * A single scope. The delete filter uses `ScopeEQ(value)`, so a
     * comma-separated list does not match; only the plural name is required.
     */
    scopes?: string;
    contains?: boolean;
};
