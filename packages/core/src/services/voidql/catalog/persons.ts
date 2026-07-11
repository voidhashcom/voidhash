/**
 * The `persons` logical view (§9). Lowers to a latest-version `persons_v1` read
 * collapsed with `LIMIT 1 BY (project_id, person_id) ORDER BY version DESC`
 * (NOT `row_number() OVER`, which would depend on the deferred window-function
 * arm — §18 gap #10), then filtered to `is_archived = 0` on the surviving latest
 * row. `email`/`name`/`traits` are PII and require the `pii` capability (§9).
 */
import { CLICKHOUSE_PERSONS_FULL_TABLE } from "../../analytics/clickhouse-accessor.ts";
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
): CatalogColumn => ({
  name,
  type,
  requires: opts.requires ?? [],
  inStar: opts.inStar ?? true,
  doc,
});

const PERSON_INNER_COLUMNS =
  "person_id, project_id, primary_distinct_id, email, name, traits, is_archived";

const personOuterProjection =
  "person_id AS person_id, project_id AS project_id, primary_distinct_id AS distinct_id, " +
  "email AS email, name AS name, traits AS traits";

const lower = (scope: AuthorizedScope, alias: string): LowerResult => {
  // Inner: latest version per (project_id, person_id). Outer: drop persons whose
  // latest row is archived (filter AFTER the collapse, mirroring the overrides
  // subquery's `is_deleted` discipline).
  const pieces: SqlPiece[] = [
    lit(
      `( SELECT ${personOuterProjection} FROM ( SELECT ${PERSON_INNER_COLUMNS} ` +
        `FROM ${CLICKHOUSE_PERSONS_FULL_TABLE} WHERE organization_id = `,
    ),
    par("String", scope.organizationId),
    lit(" AND project_id IN "),
    par("Array(String)", scope.availableProjectIds),
    lit(
      ` ORDER BY version DESC LIMIT 1 BY (project_id, person_id) ) WHERE is_archived = 0 ) AS ${alias}`,
    ),
  ];
  const injected: InjectedScope = {
    relation: "persons",
    alias,
    orgValue: scope.organizationId,
    projectValues: scope.availableProjectIds,
  };
  return { pieces, injected };
};

const namespaces: Readonly<Record<string, CatalogPropertyNamespace>> = {
  traits: {
    name: "traits",
    sourceColumn: "traits",
    requires: ["pii"],
    doc: "Custom person traits (JSON, PII). Access via traits.<key>.",
  },
};

export const personsTable: CatalogTable = {
  name: "persons",
  columns: {
    person_id: col("person_id", "String", "Stable person id."),
    distinct_id: col("distinct_id", "String", "The person's primary distinct id."),
    project_id: col("project_id", "String", "The project the person belongs to."),
    email: col("email", "String", "Person email (PII).", { requires: ["pii"], inStar: false }),
    name: col("name", "String", "Person name (PII).", { requires: ["pii"], inStar: false }),
  },
  namespaces,
  lower,
};
