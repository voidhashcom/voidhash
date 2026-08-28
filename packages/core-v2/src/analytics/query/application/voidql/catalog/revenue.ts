/**
 * The `revenue` logical view: a semantic view over `events` pre-filtered to
 * the revenue event-name set, with `amount_usd` already in dollars and FX-less
 * rows zeroed — encoding the canonical money semantics (`amount_usd` is
 * stored in cents; an FX-less row contributes 0, a bounded under-count). Agents
 * get a "revenue table" without knowing the `$purchase.completed`/`$subscription.*`
 * taxonomy.
 */
import { constant } from "@voidhash/lib/lang";
import { REVENUE_MONEY_EVENT_NAMES } from "../../../../domain/InternalAnalyticsEvents.ts";

import { buildEventsLower, eventsTable } from "./events.ts";
import type { CatalogColumn, CatalogTable } from "./types.ts";

const REVENUE_EVENT_NAMES = constant([...REVENUE_MONEY_EVENT_NAMES]);

// Code-derived constants only (event names + JSON keys) — safe to splice.
const EVENT_NAME_FILTER = `event_name IN (${REVENUE_EVENT_NAMES.map((n) => `'${n}'`).join(", ")})`;

// USD-only, in dollars: the canonical `gross_amount_usd` money fields coalesced
// over the deprecated `amount_usd` mirrors (snake/camel, FX-less → 0) / 100.
const AMOUNT_USD_EXPR =
  "(coalesce(nullIf(JSONExtractFloat(events.event_properties, 'gross_amount_usd'), 0), " +
  "nullIf(JSONExtractFloat(events.event_properties, 'grossAmountUsd'), 0), " +
  "nullIf(JSONExtractFloat(events.event_properties, 'amount_usd'), 0), " +
  "nullIf(JSONExtractFloat(events.event_properties, 'amountUsd'), 0), 0)) / 100";

const amountColumn: CatalogColumn = {
  name: "amount_usd",
  type: "Float64",
  requires: [],
  inStar: true,
  doc: "Revenue amount in USD dollars (FX-less rows count as 0).",
};

export const revenueTable: CatalogTable = {
  name: "revenue",
  columns: { ...eventsTable.columns, amount_usd: amountColumn },
  namespaces: eventsTable.namespaces,
  lower: (scope, alias) =>
    buildEventsLower("revenue", scope, alias, {
      eventNameFilter: EVENT_NAME_FILTER,
      extraProjection: `, ${AMOUNT_USD_EXPR} AS amount_usd`,
    }),
};
