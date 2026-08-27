/**
 * The VoidQL abstract syntax tree.
 *
 * Plain-TypeScript `readonly` tagged-union interfaces discriminated by `_tag`.
 * The parser is the sole constructor of these nodes; the tree is built from
 * query text and never deserialized from JSON. Exhaustiveness is enforced at
 * compile time by the printer's `default: node satisfies never` checks.
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
 * JS `number` as `Decimal`, degrading partition pruning. Validity of
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
 * against the closed function registry so the allow-list is single-sourced.
 */
export interface FnCall extends Node {
  readonly _tag: "FnCall";
  readonly name: string;
  readonly args: readonly Expr[];
}

export type WindowFrameBound = "unboundedPreceding" | "currentRow" | "unboundedFollowing";

export interface WindowFrame {
  readonly unit: "rows" | "range";
  readonly start: WindowFrameBound;
  readonly end?: WindowFrameBound;
}

export interface WindowExpr extends Node {
  readonly _tag: "WindowExpr";
  readonly fn: FnCall;
  readonly partitionBy: readonly Expr[];
  readonly orderBy: readonly OrderItem[];
  readonly frame?: WindowFrame;
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
  | "ilike"
  | "notIlike"
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
  readonly list?: readonly [Expr, ...Expr[]];
  readonly query?: Query;
  readonly negated: boolean;
}

export interface ExistsExpr extends Node {
  readonly _tag: "ExistsExpr";
  readonly query: Query;
}

export interface SubqueryExpr extends Node {
  readonly _tag: "SubqueryExpr";
  readonly query: Query;
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
  | WindowExpr
  | Binary
  | Unary
  | InExpr
  | ExistsExpr
  | SubqueryExpr
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
 * table-function class is structurally unreachable.
 */
export interface NamedTable extends Node {
  readonly _tag: "NamedTable";
  readonly name: string;
  readonly alias?: string;
}

/** A subquery source. Subqueries MUST be aliased (the parser enforces it). */
export interface SubquerySource extends Node {
  readonly _tag: "SubquerySource";
  readonly query: Query;
  readonly alias: string;
}

export type TableSource = NamedTable | SubquerySource;

export interface Join extends Node {
  readonly _tag: "Join";
  readonly kind: "inner" | "left" | "right" | "full" | "cross";
  readonly source: TableSource;
  readonly on?: Expr;
  readonly using?: readonly [string, ...string[]];
}

export interface OrderItem extends Node {
  readonly _tag: "OrderItem";
  readonly expr: Expr;
  readonly dir: "asc" | "desc";
  readonly nulls?: "first" | "last";
}

export interface Cte extends Node {
  readonly _tag: "Cte";
  readonly name: string;
  readonly query: Query;
}

export interface LimitBy {
  readonly limit: number;
  readonly offset?: number;
  readonly by: readonly [Expr, ...Expr[]];
}

export interface Select extends Node {
  readonly _tag: "Select";
  readonly with: readonly Cte[];
  readonly distinct: boolean;
  readonly distinctOn: readonly Expr[];
  readonly columns: readonly [SelectItem, ...SelectItem[]];
  readonly from?: TableSource;
  readonly joins: readonly Join[];
  readonly prewhere?: Expr;
  readonly where?: Expr;
  readonly groupBy: readonly Expr[];
  readonly groupByModifier?: "rollup" | "cube";
  readonly withTotals: boolean;
  readonly having?: Expr;
  readonly qualify?: Expr;
  readonly orderBy: readonly OrderItem[];
  readonly limitBy?: LimitBy;
  readonly limit?: number;
  readonly offset?: number;
  readonly withTies: boolean;
}

export type SetOperator = "UNION ALL" | "UNION DISTINCT" | "INTERSECT" | "EXCEPT";

export interface SetQuery extends Node {
  readonly _tag: "SetQuery";
  readonly selects: readonly [Select, Select, ...Select[]];
  readonly operators: readonly [SetOperator, ...SetOperator[]];
}

export type Query = Select | SetQuery;
export type Statement = Query;
