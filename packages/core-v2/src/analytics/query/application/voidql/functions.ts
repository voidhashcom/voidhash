/**
 * The VoidQL function registry — a **default-deny** map of VoidQL function
 * name → ClickHouse function with arity and result type. A function is callable
 * iff it has a row; anything absent (table functions, `dictGet*`, `getSetting`,
 * `sleep`, introspection, throwing casts, next year's `azureBlobStorageCluster`)
 * is rejected with {@link VoidQlUnsupportedError}. The registry fails *closed* on
 * everything new — the inverse of a blocklist, which fails open on every release.
 *
 * Deferred families (lambdas/higher-order array functions, `arrayJoin`, and
 * parametric aggregates) remain absent until they are explicitly supported.
 * Window syntax composes with registry functions; window-only functions still need
 * an explicit row here.
 */
import type { VoidQLType } from "./catalog/types.ts";

/** A function's result type, or `{ arg: i }` to mean "the type of argument i". */
export type FnReturn = VoidQLType | { readonly arg: number };

export interface FnSpec {
  /** The ClickHouse function this lowers to. */
  readonly chName: string;
  readonly minArgs: number;
  readonly maxArgs: number;
  readonly returns: FnReturn;
  /** Whether a bare `*` is an acceptable sole argument (only `count(*)`). */
  readonly allowStar?: boolean;
  /** Whether the function is only valid when immediately followed by `OVER`. */
  readonly windowOnly?: boolean;
}

const REGISTRY: Readonly<Record<string, FnSpec>> = {
  // ── aggregations (the core of analytics; pure, deterministic) ──
  count: {
    chName: "count",
    minArgs: 0,
    maxArgs: 1,
    returns: "UInt64",
    allowStar: true,
  },
  countif: { chName: "countIf", minArgs: 1, maxArgs: 1, returns: "UInt64" },
  countdistinct: {
    chName: "uniqExact",
    minArgs: 1,
    maxArgs: 64,
    returns: "UInt64",
  },
  sum: { chName: "sum", minArgs: 1, maxArgs: 1, returns: "Float64" },
  sumif: { chName: "sumIf", minArgs: 2, maxArgs: 2, returns: "Float64" },
  avg: { chName: "avg", minArgs: 1, maxArgs: 1, returns: "Float64" },
  min: { chName: "min", minArgs: 1, maxArgs: 1, returns: { arg: 0 } },
  max: { chName: "max", minArgs: 1, maxArgs: 1, returns: { arg: 0 } },
  any: { chName: "any", minArgs: 1, maxArgs: 1, returns: { arg: 0 } },
  argmin: { chName: "argMin", minArgs: 2, maxArgs: 2, returns: { arg: 0 } },
  argmax: { chName: "argMax", minArgs: 2, maxArgs: 2, returns: { arg: 0 } },
  rownumber: {
    chName: "row_number",
    minArgs: 0,
    maxArgs: 0,
    returns: "UInt64",
    windowOnly: true,
  },
  rank: {
    chName: "rank",
    minArgs: 0,
    maxArgs: 0,
    returns: "UInt64",
    windowOnly: true,
  },
  denserank: {
    chName: "dense_rank",
    minArgs: 0,
    maxArgs: 0,
    returns: "UInt64",
    windowOnly: true,
  },

  // ── conditional / null handling (pure scalar control flow) ──
  if: { chName: "if", minArgs: 3, maxArgs: 3, returns: { arg: 1 } },
  multiif: { chName: "multiIf", minArgs: 3, maxArgs: 99, returns: { arg: 1 } },
  coalesce: { chName: "coalesce", minArgs: 1, maxArgs: 99, returns: { arg: 0 } },
  nullif: { chName: "nullIf", minArgs: 2, maxArgs: 2, returns: { arg: 0 } },
  ifnull: { chName: "ifNull", minArgs: 2, maxArgs: 2, returns: { arg: 0 } },
  greatest: { chName: "greatest", minArgs: 2, maxArgs: 99, returns: { arg: 0 } },
  least: { chName: "least", minArgs: 2, maxArgs: 99, returns: { arg: 0 } },

  // ── string / hash (pure) ──
  lower: { chName: "lower", minArgs: 1, maxArgs: 1, returns: "String" },
  upper: { chName: "upper", minArgs: 1, maxArgs: 1, returns: "String" },
  length: { chName: "length", minArgs: 1, maxArgs: 1, returns: "UInt64" },
  trim: { chName: "trim", minArgs: 1, maxArgs: 1, returns: "String" },
  concat: { chName: "concat", minArgs: 2, maxArgs: 99, returns: "String" },
  substring: { chName: "substring", minArgs: 2, maxArgs: 3, returns: "String" },
  startswith: { chName: "startsWith", minArgs: 2, maxArgs: 2, returns: "Bool" },
  endswith: { chName: "endsWith", minArgs: 2, maxArgs: 2, returns: "Bool" },
  position: { chName: "position", minArgs: 2, maxArgs: 2, returns: "UInt64" },
  replaceall: { chName: "replaceAll", minArgs: 3, maxArgs: 3, returns: "String" },
  // regex allowed but the query is cost-capped.
  match: { chName: "match", minArgs: 2, maxArgs: 2, returns: "Bool" },
  replaceregexpall: {
    chName: "replaceRegexpAll",
    minArgs: 3,
    maxArgs: 3,
    returns: "String",
  },
  cityhash64: {
    chName: "cityHash64",
    minArgs: 1,
    maxArgs: 99,
    returns: "UInt64",
  },

  // ── date / math (pure) ──
  tostartofhour: {
    chName: "toStartOfHour",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
  },
  tostartofminute: {
    chName: "toStartOfMinute",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
  },
  tostartofday: {
    chName: "toStartOfDay",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
  },
  tostartofweek: {
    chName: "toStartOfWeek",
    minArgs: 1,
    maxArgs: 2,
    returns: "DateTime",
  },
  tostartofmonth: {
    chName: "toStartOfMonth",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
  },
  tostartofquarter: {
    chName: "toStartOfQuarter",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
  },
  tostartofyear: {
    chName: "toStartOfYear",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
  },
  todate: { chName: "toDate", minArgs: 1, maxArgs: 1, returns: "DateTime" },
  datediff: { chName: "dateDiff", minArgs: 3, maxArgs: 3, returns: "Int64" },
  toyear: { chName: "toYear", minArgs: 1, maxArgs: 1, returns: "UInt64" },
  tomonth: { chName: "toMonth", minArgs: 1, maxArgs: 1, returns: "UInt64" },
  todayofweek: {
    chName: "toDayOfWeek",
    minArgs: 1,
    maxArgs: 1,
    returns: "UInt64",
  },
  round: { chName: "round", minArgs: 1, maxArgs: 2, returns: "Float64" },
  floor: { chName: "floor", minArgs: 1, maxArgs: 2, returns: "Float64" },
  ceil: { chName: "ceil", minArgs: 1, maxArgs: 2, returns: "Float64" },
  abs: { chName: "abs", minArgs: 1, maxArgs: 1, returns: { arg: 0 } },
  sqrt: { chName: "sqrt", minArgs: 1, maxArgs: 1, returns: "Float64" },
  pow: { chName: "pow", minArgs: 2, maxArgs: 2, returns: "Float64" },
  exp: { chName: "exp", minArgs: 1, maxArgs: 1, returns: "Float64" },
  log: { chName: "log", minArgs: 1, maxArgs: 1, returns: "Float64" },
  // only the null-safe casts (HogQL's leading-underscore rule) — never throwing casts
  tofloat64ornull: {
    chName: "toFloat64OrNull",
    minArgs: 1,
    maxArgs: 1,
    returns: "Float64",
  },
  toint64ornull: {
    chName: "toInt64OrNull",
    minArgs: 1,
    maxArgs: 1,
    returns: "Int64",
  },
  todateornull: {
    chName: "toDateOrNull",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
  },
};

/** Resolve a VoidQL function name (case-insensitive) to its spec, or `undefined`. */
export const lookupFunction = (name: string): FnSpec | undefined => REGISTRY[name.toLowerCase()];

/** All registered VoidQL function names (for agent/editor schema context). */
export const registeredFunctionNames = (): readonly string[] => Object.keys(REGISTRY);
