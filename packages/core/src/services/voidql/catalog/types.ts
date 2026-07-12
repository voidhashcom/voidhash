/**
 * The virtual-schema catalog model (§9). Users write SQL against *logical* tables
 * (`events`, `persons`, `revenue`) and logical columns — never physical reality.
 * A name either resolves to a code-curated, capability-checked physical expression
 * or the query is rejected (default-deny; the HogQL virtual-DB model + the
 * PSA-2025-00001 lesson). The raw `events_v2`/`persons_v1` tables, the JSON blobs,
 * and `organization_id`/`token`/`processed_ts` are simply absent → unresolvable.
 */
import type { SqlPiece } from "../ir.ts";
import type { AuthorizedScope } from "../scope.ts";

export type VoidQLType = "String" | "Int64" | "UInt64" | "Float64" | "Bool" | "DateTime" | "UUID";

/** Capabilities resolved once per query from `AuthSession.permissions` + principal kind. */
export type Capability = "pii";

/** An output column of a (sub)query: name + resolved type — drives result decoding. */
export interface ColumnSpec {
  readonly name: string;
  readonly type: VoidQLType;
}

export interface CatalogColumn {
  /** Logical name the user types. */
  readonly name: string;
  readonly type: VoidQLType;
  /** Required capabilities; `[]` = open. */
  readonly requires: readonly Capability[];
  /** Included in `SELECT *`? PII columns are `false` even for a capable caller. */
  readonly inStar: boolean;
  /** Surfaced to AI agents and the editor as schema context. */
  readonly doc: string;
}

/**
 * A JSON-blob namespace (`properties`, `context`, `traits`). A `<namespace>.<key>`
 * access lowers to `JSONExtractString(<alias>.<sourceColumn>, {pKey:String})` —
 * the key is **bound**, never escaped (§9, §18 gap #1).
 */
export interface CatalogPropertyNamespace {
  readonly name: string;
  /** The logical column on this table holding the JSON String. */
  readonly sourceColumn: string;
  readonly requires: readonly Capability[];
  readonly doc: string;
}

/** Recorded per base-table occurrence; the verifier checks each binds to the scope. */
export interface InjectedScope {
  readonly relation: "events" | "persons" | "revenue";
  readonly alias: string;
  readonly orgValue: string;
  readonly projectValues: readonly string[];
}

export interface LowerResult {
  /** The `(…scoped subquery…) AS <alias>` relation pieces. */
  readonly pieces: readonly SqlPiece[];
  /** The scope this lowering injected, for the value-level verifier. */
  readonly injected: InjectedScope;
}

export interface CatalogTable {
  readonly name: "events" | "persons" | "revenue";
  readonly columns: Readonly<Record<string, CatalogColumn>>;
  readonly namespaces: Readonly<Record<string, CatalogPropertyNamespace>>;
  /**
   * Lower this logical view to a pre-scoped subquery carrying the bound
   * `organization_id`/`project_id` predicate inline (NOT via `tenantSettings` —
   * the P1 blocker), wrapping the audited dedup/identity machinery. The ONLY
   * producer of physical table identity.
   */
  readonly lower: (scope: AuthorizedScope, alias: string) => LowerResult;
}

/** Map a logical type to the explicit ClickHouse `ch.param` type string (§18 gap #9). */
export const chParamType = (type: VoidQLType): string => {
  switch (type) {
    case "String":
    case "UUID":
      return "String";
    case "Int64":
      return "Int64";
    case "UInt64":
      return "UInt64";
    case "Float64":
      return "Float64";
    case "Bool":
      return "Bool";
    case "DateTime":
      return "DateTime";
  }
};
