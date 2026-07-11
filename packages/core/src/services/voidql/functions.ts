/**
 * The VoidQL function registry (§11) — a **default-deny** map of VoidQL function
 * name → ClickHouse function with arity and result type. A function is callable
 * iff it has a row; anything absent (table functions, `dictGet*`, `getSetting`,
 * `sleep`, introspection, throwing casts, next year's `azureBlobStorageCluster`)
 * is rejected with {@link VoidQlUnsupportedError}. The registry fails *closed* on
 * everything new — the inverse of a blocklist, which fails open on every release.
 *
 * Deferred families (lambdas/higher-order array fns, window fns, `arrayJoin`,
 * parametric aggregates) are simply absent until they land behind a Security-Review
 * Gate.
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
  readonly aggregate: boolean;
  /** Whether a bare `*` is an acceptable sole argument (only `count(*)`). */
  readonly allowStar?: boolean;
}

const REGISTRY: Readonly<Record<string, FnSpec>> = {
  // ── aggregations (the core of analytics; pure, deterministic) ──
  count: {
    chName: "count",
    minArgs: 0,
    maxArgs: 1,
    returns: "UInt64",
    aggregate: true,
    allowStar: true,
  },
  countif: { chName: "countIf", minArgs: 1, maxArgs: 1, returns: "UInt64", aggregate: true },
  countdistinct: {
    chName: "uniqExact",
    minArgs: 1,
    maxArgs: 64,
    returns: "UInt64",
    aggregate: true,
  },
  sum: { chName: "sum", minArgs: 1, maxArgs: 1, returns: "Float64", aggregate: true },
  sumif: { chName: "sumIf", minArgs: 2, maxArgs: 2, returns: "Float64", aggregate: true },
  avg: { chName: "avg", minArgs: 1, maxArgs: 1, returns: "Float64", aggregate: true },
  min: { chName: "min", minArgs: 1, maxArgs: 1, returns: { arg: 0 }, aggregate: true },
  max: { chName: "max", minArgs: 1, maxArgs: 1, returns: { arg: 0 }, aggregate: true },
  any: { chName: "any", minArgs: 1, maxArgs: 1, returns: { arg: 0 }, aggregate: true },
  argmin: { chName: "argMin", minArgs: 2, maxArgs: 2, returns: { arg: 0 }, aggregate: true },
  argmax: { chName: "argMax", minArgs: 2, maxArgs: 2, returns: { arg: 0 }, aggregate: true },

  // ── conditional / null handling (pure scalar control flow) ──
  if: { chName: "if", minArgs: 3, maxArgs: 3, returns: { arg: 1 }, aggregate: false },
  multiif: { chName: "multiIf", minArgs: 3, maxArgs: 99, returns: { arg: 1 }, aggregate: false },
  coalesce: { chName: "coalesce", minArgs: 1, maxArgs: 99, returns: { arg: 0 }, aggregate: false },
  nullif: { chName: "nullIf", minArgs: 2, maxArgs: 2, returns: { arg: 0 }, aggregate: false },
  ifnull: { chName: "ifNull", minArgs: 2, maxArgs: 2, returns: { arg: 0 }, aggregate: false },
  greatest: { chName: "greatest", minArgs: 2, maxArgs: 99, returns: { arg: 0 }, aggregate: false },
  least: { chName: "least", minArgs: 2, maxArgs: 99, returns: { arg: 0 }, aggregate: false },

  // ── string / hash (pure) ──
  lower: { chName: "lower", minArgs: 1, maxArgs: 1, returns: "String", aggregate: false },
  upper: { chName: "upper", minArgs: 1, maxArgs: 1, returns: "String", aggregate: false },
  concat: { chName: "concat", minArgs: 2, maxArgs: 99, returns: "String", aggregate: false },
  substring: { chName: "substring", minArgs: 2, maxArgs: 3, returns: "String", aggregate: false },
  startswith: { chName: "startsWith", minArgs: 2, maxArgs: 2, returns: "Bool", aggregate: false },
  // regex allowed but the query is cost-capped (ReDoS → bounded-time abort, §11).
  match: { chName: "match", minArgs: 2, maxArgs: 2, returns: "Bool", aggregate: false },
  replaceregexpall: {
    chName: "replaceRegexpAll",
    minArgs: 3,
    maxArgs: 3,
    returns: "String",
    aggregate: false,
  },
  cityhash64: {
    chName: "cityHash64",
    minArgs: 1,
    maxArgs: 99,
    returns: "UInt64",
    aggregate: false,
  },

  // ── date / math (pure) ──
  tostartofhour: {
    chName: "toStartOfHour",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
    aggregate: false,
  },
  tostartofday: {
    chName: "toStartOfDay",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
    aggregate: false,
  },
  tostartofweek: {
    chName: "toStartOfWeek",
    minArgs: 1,
    maxArgs: 2,
    returns: "DateTime",
    aggregate: false,
  },
  tostartofmonth: {
    chName: "toStartOfMonth",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
    aggregate: false,
  },
  tostartofquarter: {
    chName: "toStartOfQuarter",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
    aggregate: false,
  },
  tostartofyear: {
    chName: "toStartOfYear",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
    aggregate: false,
  },
  todate: { chName: "toDate", minArgs: 1, maxArgs: 1, returns: "DateTime", aggregate: false },
  datediff: { chName: "dateDiff", minArgs: 3, maxArgs: 3, returns: "Int64", aggregate: false },
  round: { chName: "round", minArgs: 1, maxArgs: 2, returns: "Float64", aggregate: false },
  floor: { chName: "floor", minArgs: 1, maxArgs: 2, returns: "Float64", aggregate: false },
  abs: { chName: "abs", minArgs: 1, maxArgs: 1, returns: { arg: 0 }, aggregate: false },
  // only the null-safe casts (HogQL's leading-underscore rule) — never throwing casts
  tofloat64ornull: {
    chName: "toFloat64OrNull",
    minArgs: 1,
    maxArgs: 1,
    returns: "Float64",
    aggregate: false,
  },
  toint64ornull: {
    chName: "toInt64OrNull",
    minArgs: 1,
    maxArgs: 1,
    returns: "Int64",
    aggregate: false,
  },
  todateornull: {
    chName: "toDateOrNull",
    minArgs: 1,
    maxArgs: 1,
    returns: "DateTime",
    aggregate: false,
  },
};

/** Resolve a VoidQL function name (case-insensitive) to its spec, or `undefined`. */
export const lookupFunction = (name: string): FnSpec | undefined => REGISTRY[name.toLowerCase()];

/** All registered VoidQL function names (for agent/editor schema context). */
export const registeredFunctionNames = (): readonly string[] => Object.keys(REGISTRY);
