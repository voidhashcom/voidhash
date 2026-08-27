/**
 * The VoidQL virtual catalog registry — the *only* relation names in the query
 * namespace. A `FROM`/`JOIN` relation must resolve to one of these, a CTE, or a
 * derived alias. Everything else fails compilation, so table functions and
 * `system.*` are structurally unreachable.
 */
import { eventsTable } from "./events.ts";
import { personsTable } from "./persons.ts";
import { revenueTable } from "./revenue.ts";
import type { CatalogTable } from "./types.ts";

/**
 * Catalog version a saved query is authored against; bumped on any change to the
 * exposed surface so `analytics_saved_query.schema_version` stays meaningful.
 */
export const CATALOG_SCHEMA_VERSION = 1;

export const CATALOG: Readonly<Record<string, CatalogTable>> = {
  events: eventsTable,
  persons: personsTable,
  revenue: revenueTable,
};

/** Reserved internal aliases the substitution injects; not bindable by users. */
export const RESERVED_INTERNAL_ALIASES = new Set([
  "events",
  "persons",
  "pending_overrides",
  "voidql_union",
]);

export const getCatalogTable = (name: string): CatalogTable | undefined => CATALOG[name];

export * from "./types.ts";
export { eventsTable, personsTable, revenueTable };
