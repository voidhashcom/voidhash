/**
 * The `events` logical view lowers to the canonical resolved-events shape,
 * automatically deduplicated
 * (`LIMIT 1 BY event_id ORDER BY processed_ts DESC`) and identity-resolved
 * (`effective*IdExpression`) — so raw analytics record tables are never
 * reachable. Tenant predicates are bound inside the inner `WHERE`.
 */
import {
  CLICKHOUSE_EVENTS_FULL_TABLE,
  CLICKHOUSE_PENDING_OVERRIDES_FULL_TABLE,
  effectiveDistinctIdExpression,
  effectivePersonIdExpression,
} from "../dialect.ts";
import { lit, par, type SqlPiece } from "../ir.ts";
import type { AuthorizedScope } from "../scope.ts";
import type {
  CatalogColumn,
  CatalogPropertyNamespace,
  CatalogTable,
  InjectedScope,
  LowerResult,
  VoidQLType,
} from "./types.ts";

const col = (
  name: string,
  type: VoidQLType,
  doc: string,
  opts: { readonly requires?: readonly ["pii"]; readonly inStar?: boolean } = {},
) =>
  ({
    name,
    type,
    requires: opts.requires ?? [],
    inStar: opts.inStar ?? true,
    doc,
  }) satisfies CatalogColumn;

/** Columns the inner dedup scan reads from the event compatibility view. */
const EVENT_INNER_COLUMNS =
  "event_id, event_name, event_ts, project_id, distinct_id, person_id, event_properties, context";

/** Outer projection re-aliasing physical → logical names, with identity resolution. */
const eventOuterProjection = (extra: string) =>
  `events.event_id AS event_id, events.event_name AS event_name, events.event_ts AS event_ts, ` +
  `events.project_id AS project_id, ${effectivePersonIdExpression} AS person_id, ` +
  `${effectiveDistinctIdExpression} AS distinct_id, events.event_properties AS event_properties, ` +
  `events.context AS context${extra}`;

/**
 * The identity-resolution LEFT JOIN, **scoped inline**. We inline
 * `organization_id = {pOrg} AND project_id IN
 * {pPids}` into the pending-overrides scan too — otherwise it would read every
 * tenant's overrides (the P1-blocker class, here applied to the identity join). The
 * inner alias stays `events`/`pending_overrides` so the imported `effective*Id`
 * expressions resolve.
 */
const scopedIdentityJoin = (scope: AuthorizedScope) => [
  lit(
    ` ) AS events LEFT JOIN ( SELECT project_id, source_distinct_id, target_distinct_id, person_id ` +
      `FROM ( SELECT project_id, source_distinct_id, target_distinct_id, person_id, is_deleted, version, changed_at ` +
      `FROM ${CLICKHOUSE_PENDING_OVERRIDES_FULL_TABLE} WHERE version > 0 AND organization_id = `,
  ),
  par("String", scope.organizationId),
  lit(" AND project_id IN "),
  par("Array(String)", scope.availableProjectIds),
  lit(
    " ORDER BY project_id ASC, source_distinct_id ASC, version DESC, changed_at DESC " +
      "LIMIT 1 BY project_id, source_distinct_id ) WHERE is_deleted = 0 ) AS pending_overrides " +
      "ON pending_overrides.project_id = events.project_id " +
      "AND pending_overrides.source_distinct_id = events.distinct_id",
  ),
];

/**
 * Build the scoped events relation shared by `events` and `revenue`. Emits
 * `( <outer projection> FROM ( <dedup scan, scoped> ) AS events <scoped identity join> ) AS <alias>`,
 * with `organization_id`/`project_id` bound out-of-band inside BOTH the dedup scan
 * and the identity-join subquery (two scoped physical reads per lowering).
 */
export const buildEventsLower = (
  relation: "events" | "revenue",
  scope: AuthorizedScope,
  alias: string,
  options: { readonly eventNameFilter?: string; readonly extraProjection?: string } = {},
): LowerResult => {
  const pieces: SqlPiece[] = [
    lit(
      `( SELECT ${eventOuterProjection(options.extraProjection ?? "")} ` +
        `FROM ( SELECT ${EVENT_INNER_COLUMNS} FROM ${CLICKHOUSE_EVENTS_FULL_TABLE} ` +
        `WHERE organization_id = `,
    ),
    par("String", scope.organizationId),
    lit(" AND project_id IN "),
    par("Array(String)", scope.availableProjectIds),
  ];
  if (options.eventNameFilter) {
    pieces.push(lit(` AND ${options.eventNameFilter}`));
  }
  pieces.push(lit(" ORDER BY processed_ts DESC LIMIT 1 BY event_id"));
  pieces.push(...scopedIdentityJoin(scope));
  pieces.push(lit(` ) AS ${alias}`));
  const injected: InjectedScope = {
    relation,
    alias,
    orgValue: scope.organizationId,
    projectValues: scope.availableProjectIds,
  };
  return { pieces, injected };
};

const namespaces: Readonly<Record<string, CatalogPropertyNamespace>> = {
  properties: {
    name: "properties",
    sourceColumn: "event_properties",
    requires: [],
    doc: "Custom event properties (JSON). Access via properties.<key>.",
  },
  context: {
    name: "context",
    sourceColumn: "context",
    requires: [],
    doc: "Device/SDK/page context captured with the event (JSON). Access via context.<key>.",
  },
};

export const eventsTable: CatalogTable = {
  name: "events",
  columns: {
    event_id: col("event_id", "String", "Unique id of the event."),
    event_name: col("event_name", "String", "The event name, e.g. $pageview."),
    event_ts: col("event_ts", "DateTime", "When the event occurred (UTC)."),
    project_id: col("project_id", "String", "The project the event belongs to."),
    person_id: col("person_id", "String", "Identity-resolved person id."),
    distinct_id: col("distinct_id", "String", "Identity-resolved distinct id."),
  },
  namespaces,
  lower: (scope, alias) => buildEventsLower("events", scope, alias),
};
