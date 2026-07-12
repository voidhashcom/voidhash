/**
 * The VoidQL abstract syntax tree.
 *
 * Plain-TypeScript `readonly` tagged-union interfaces discriminated by `_tag` —
 * deliberately **no `Schema` and no decode step** (see `docs/analytics-access-layer.html`
 * §8.2). The parser ({@link file://../parser.ts}) is the *sole, trusted constructor*
 * of these nodes; the tree is only ever built server-side from query text and is
 * never deserialised from foreign JSON, so a `Schema.decode` boundary would guard
 * an input that cannot occur. The one guarantee that matters — exhaustiveness — is
 * obtained at *compile time* from the printer's `default: node satisfies never`,
 * which is strictly stronger than TRQL's runtime `NotImplementedError` and HogQL's
 * runtime `getattr` dispatch.
 *
 * There is intentionally **no raw-SQL node**: user text can never travel to
 * `ch.literal`. Field-level validity (e.g. `numType` ∈ three values, a non-empty
 * column `chain`) is the parser's and resolver's responsibility, since no runtime
 * boundary re-checks it.
 */

/** A source position, used to render caret-precise diagnostics. */
export interface Pos {
  readonly line: number;
  readonly col: number;
  readonly offset: number;
}

/** A source span (half-open: `[start, end)`), carried by every node. */
export interface Span {
  readonly start: Pos;
  readonly end: Pos;
}

interface Node {
  readonly span: Span;
}

// ─────────────────────────────── expressions ────────────────────────────────

export interface StringLit extends Node {
  readonly _tag: "StringLit";
  readonly value: string;
}

/**
 * A numeric literal. `numType` carries the resolved scalar type so the printer
 * can emit an *explicit* `ch.param` type — the substrate would otherwise infer a
 * JS `number` as `Decimal`, degrading partition pruning (§18 gap #9). Validity of
 * `numType` is the parser's responsibility; no decode boundary re-checks it.
 */
export interface NumberLit extends Node {
  readonly _tag: "NumberLit";
  readonly value: number;
  readonly numType: "Int64" | "UInt64" | "Float64";
}

export interface BoolLit extends Node {
  readonly _tag: "BoolLit";
  readonly value: boolean;
}

export interface NullLit extends Node {
  readonly _tag: "NullLit";
}

/**
 * A column reference as a dotted chain (HogQL's `Field(chain=[...])`). Whether
 * `a.b` is `table.column` or a JSON-property access is decided by the *resolver*,
 * never the parser.
 */
export interface ColumnRef extends Node {
  readonly _tag: "ColumnRef";
  readonly chain: readonly [string, ...string[]];
}

export interface StarRef extends Node {
  readonly _tag: "StarRef";
  readonly qualifier?: string;
}

/**
 * A function call. The `name` is just a token here; the resolver checks it
 * against the closed function registry (§11) so the allow-list is single-sourced.
 */
export interface FnCall extends Node {
  readonly _tag: "FnCall";
  readonly name: string;
  readonly args: readonly Expr[];
}

export type BinaryOp =
  | "or"
  | "and"
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "like"
  | "notLike"
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "mod";

export interface Binary extends Node {
  readonly _tag: "Binary";
  readonly op: BinaryOp;
  readonly left: Expr;
  readonly right: Expr;
}

export interface Unary extends Node {
  readonly _tag: "Unary";
  readonly op: "not" | "neg";
  readonly expr: Expr;
}

export interface InExpr extends Node {
  readonly _tag: "InExpr";
  readonly expr: Expr;
  readonly list: readonly Expr[];
  readonly negated: boolean;
}

export interface Between extends Node {
  readonly _tag: "Between";
  readonly expr: Expr;
  readonly low: Expr;
  readonly high: Expr;
  readonly negated: boolean;
}

export interface IsNull extends Node {
  readonly _tag: "IsNull";
  readonly expr: Expr;
  readonly negated: boolean;
}

export interface CaseWhen {
  readonly when: Expr;
  readonly then: Expr;
}

export interface CaseExpr extends Node {
  readonly _tag: "CaseExpr";
  readonly operand?: Expr;
  readonly whens: readonly [CaseWhen, ...CaseWhen[]];
  readonly else?: Expr;
}

export interface Paren extends Node {
  readonly _tag: "Paren";
  readonly expr: Expr;
}

export type Expr =
  | StringLit
  | NumberLit
  | BoolLit
  | NullLit
  | ColumnRef
  | StarRef
  | FnCall
  | Binary
  | Unary
  | InExpr
  | Between
  | IsNull
  | CaseExpr
  | Paren;

// ─────────────────────────────── statements ─────────────────────────────────

export interface SelectItem extends Node {
  readonly _tag: "SelectItem";
  readonly expr: Expr;
  readonly alias?: string;
}

/**
 * A named `FROM`/`JOIN` source. There is deliberately no `db.table` and no table
 * function — those have *no grammar production at all*, so the CVE-2025-1520
 * table-function class is structurally unreachable (§8.1, §11).
 */
export interface NamedTable extends Node {
  readonly _tag: "NamedTable";
  readonly name: string;
  readonly alias?: string;
}

/** A subquery source. Subqueries MUST be aliased (the parser enforces it). */
export interface SubquerySource extends Node {
  readonly _tag: "SubquerySource";
  readonly query: Select;
  readonly alias: string;
}

export type TableSource = NamedTable | SubquerySource;

export interface Join extends Node {
  readonly _tag: "Join";
  readonly kind: "inner" | "left";
  readonly source: TableSource;
  readonly on: Expr;
}

export interface OrderItem extends Node {
  readonly _tag: "OrderItem";
  readonly expr: Expr;
  readonly dir: "asc" | "desc";
}

export interface Cte extends Node {
  readonly _tag: "Cte";
  readonly name: string;
  readonly query: Select;
}

export interface Select extends Node {
  readonly _tag: "Select";
  readonly with: readonly Cte[];
  readonly columns: readonly [SelectItem, ...SelectItem[]];
  readonly from: TableSource;
  readonly joins: readonly Join[];
  readonly where?: Expr;
  readonly groupBy: readonly Expr[];
  readonly having?: Expr;
  readonly orderBy: readonly OrderItem[];
  readonly limit?: number;
  readonly offset?: number;
}

// `UNION ALL` (`SetQuery`) is a deferred construct — removed from the grammar
// until it lands behind its own Security-Review Gate (§11). Until then a single
// `Select` is the whole statement surface.
export type Statement = Select;
