/**
 * The VoidQL resolve-and-print pass — stages ③–⑤ of the VM (§12).
 *
 * Walks the AST with a scope stack, resolving every name against the virtual
 * catalog, the closed function registry, and the PII capability set; performs the
 * **logical-view substitution** (L2, §10) so each base relation lowers to a
 * pre-scoped subquery carrying the bound `organization_id`/`project_id` literals;
 * and emits the {@link SqlPiece} IR through `lit()`/`par()` — every user value a
 * bound parameter, all structural SQL from frozen catalog constants and validated
 * identifiers. The result feeds the value-level verifier (§10) and {@link toStatement}.
 *
 * Resolution and printing are a single pass because the alias a column binds to is
 * needed exactly at print time (HogQL/TRQL both resolve-while-printing). Field-level
 * re-assertions the dropped decode boundary used to do (a non-empty `chain`, a valid
 * `numType`) live here.
 */
import { toClickhouseDateTime } from "../analytics/clickhouse-accessor.ts";
import type {
  Binary,
  CaseExpr,
  ColumnRef,
  Expr,
  FnCall,
  InExpr,
  OrderItem,
  Query,
  Select,
  SelectItem,
  TableSource,
} from "./ast/VoidQlAst.ts";
import { CATALOG, RESERVED_INTERNAL_ALIASES } from "./catalog/index.ts";
import {
  type CatalogTable,
  type Capability,
  chParamType,
  type ColumnSpec,
  type VoidQLType,
} from "./catalog/types.ts";
import {
  VoidQlPiiError,
  VoidQlSchemaError,
  VoidQlSyntaxError,
  VoidQlUnknownFieldError,
  VoidQlUnsupportedError,
} from "./errors.ts";
import { type FnSpec, lookupFunction } from "./functions.ts";
import type { InjectedScope } from "./catalog/types.ts";
import { lit, par, type SqlPiece } from "./ir.ts";
import type { AuthorizedScope } from "./scope.ts";

/** Largest result set VoidQL will return; the server clamps every LIMIT to it (§7 L6, §12). */
export const MAX_RESULT_ROWS = 100_000;

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
// Identifiers shaped like a physical table version suffix (`…_v2`). Reserved as
// non-bindable so the value-level verifier's physical-table token scan can never
// be tripped by a legitimate user alias / CTE / column alias (a false-positive
// isolation failure). Physical tables are emitted only by the catalog `lower()`.
const PHYSICAL_SHAPED_RE = /_v\d+$/i;

type ResolvedRelation =
  | { readonly kind: "view"; readonly alias: string; readonly table: CatalogTable }
  | {
      readonly kind: "derived";
      readonly alias: string;
      readonly columns: ReadonlyMap<string, VoidQLType>;
    };

interface Frame {
  readonly relations: ResolvedRelation[];
  readonly cteShapes: Map<string, readonly ColumnSpec[]>;
  readonly aliases: Map<string, VoidQLType>;
  readonly parent?: Frame;
}

export interface CompiledSelect {
  readonly pieces: readonly SqlPiece[];
  /** Output columns (name + type) — drives result decoding (§20 open question). */
  readonly shape: readonly ColumnSpec[];
  /** Every base-table scope this compilation injected (for the verifier). */
  readonly injected: readonly InjectedScope[];
}

interface PrintedExpr {
  readonly pieces: readonly SqlPiece[];
  readonly type: VoidQLType;
}

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
};

export type { ColumnSpec };

const nearest = (target: string, candidates: readonly string[]): string => {
  let best = "";
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(target.toLowerCase(), c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= Math.max(2, Math.ceil(target.length / 2)) ? best : "";
};

export class Compiler {
  readonly injected: InjectedScope[] = [];
  private relationCounter = 0;

  private readonly scope: AuthorizedScope;
  private readonly capabilities: ReadonlySet<Capability>;

  constructor(scope: AuthorizedScope, capabilities: ReadonlySet<Capability>) {
    this.scope = scope;
    this.capabilities = capabilities;
  }

  // ── relations / sources ───────────────────────────────────────────────────

  private assertBindableAlias(alias: string): void {
    if (!IDENT_RE.test(alias) || PHYSICAL_SHAPED_RE.test(alias)) {
      throw new VoidQlUnsupportedError({ message: `Invalid alias '${alias}'.`, hint: "" });
    }
    if (RESERVED_INTERNAL_ALIASES.has(alias.toLowerCase())) {
      throw new VoidQlUnsupportedError({
        message: `'${alias}' is a reserved alias and cannot be used.`,
        hint: "Pick a different alias.",
      });
    }
  }

  private viewShape(table: CatalogTable): ReadonlyMap<string, VoidQLType> {
    return new Map(Object.values(table.columns).map((c) => [c.name, c.type]));
  }

  /** Resolve a FROM/JOIN source, push it onto `frame`, and return its SQL pieces. */
  private resolveSource(source: TableSource, frame: Frame): readonly SqlPiece[] {
    if (source._tag === "SubquerySource") {
      this.assertBindableAlias(source.alias);
      this.assertUniqueAlias(frame, source.alias);
      const sub = this.printQuery(source.query, frame);
      frame.relations.push({
        kind: "derived",
        alias: source.alias,
        columns: new Map(sub.shape.map((c) => [c.name, c.type])),
      });
      return [lit("( "), ...sub.pieces, lit(` ) AS ${source.alias}`)];
    }

    const nameLower = source.name.toLowerCase();
    const cteShape = this.findCteShape(frame, nameLower);
    if (cteShape) {
      const alias = source.alias ?? source.name;
      if (source.alias) this.assertBindableAlias(source.alias);
      this.assertUniqueAlias(frame, alias);
      frame.relations.push({
        kind: "derived",
        alias,
        columns: new Map(cteShape.map((c) => [c.name, c.type])),
      });
      const tail = source.alias ? ` AS ${this.id(source.alias)}` : "";
      return [lit(`${this.id(source.name)}${tail}`)];
    }

    const table = CATALOG[nameLower];
    if (!table) {
      const suggestion = nearest(source.name, Object.keys(CATALOG));
      throw new VoidQlSchemaError({
        message: `Unknown table '${source.name}'.${suggestion ? ` Did you mean '${suggestion}'?` : ""}`,
      });
    }
    if (source.alias) this.assertBindableAlias(source.alias);
    const alias = source.alias ?? `${table.name}_${this.relationCounter++}`;
    this.assertUniqueAlias(frame, alias);
    const lowered = table.lower(this.scope, alias);
    this.injected.push(lowered.injected);
    frame.relations.push({ kind: "view", alias, table });
    return lowered.pieces;
  }

  private assertUniqueAlias(frame: Frame, alias: string): void {
    if (frame.relations.some((r) => r.alias.toLowerCase() === alias.toLowerCase())) {
      throw new VoidQlUnsupportedError({
        message: `Duplicate relation alias '${alias}'.`,
        hint: "Give each table/subquery a distinct alias.",
      });
    }
  }

  private findRelation(frame: Frame, aliasLower: string): ResolvedRelation | undefined {
    return frame.relations.find((relation) => relation.alias.toLowerCase() === aliasLower);
  }

  private findExpressionAlias(frame: Frame, aliasLower: string): VoidQLType | undefined {
    return frame.aliases.get(aliasLower);
  }

  private findCteShape(
    frame: Frame | undefined,
    nameLower: string,
  ): readonly ColumnSpec[] | undefined {
    for (let f = frame; f; f = f.parent) {
      const match = f.cteShapes.get(nameLower);
      if (match) return match;
    }
    return undefined;
  }

  // ── columns / properties ────────────────────────────────────────────────

  private relationColumnNames(rel: ResolvedRelation): readonly string[] {
    return rel.kind === "view" ? Object.keys(rel.table.columns) : [...rel.columns.keys()];
  }

  /**
   * Validate a single identifier at the point it is spliced into `lit()` — making
   * "only charset-safe identifiers reach ch.literal" explicit at the emission site
   * rather than an upstream invariant (§12). Every alias/column/namespace identifier
   * is already catalog-derived or parser-tokenised, so this never fires in practice;
   * it is the belt against a future code path that forgets to validate.
   */
  private id(name: string): string {
    if (!IDENT_RE.test(name)) {
      throw new VoidQlUnsupportedError({ message: `Invalid identifier '${name}'.`, hint: "" });
    }
    return name;
  }

  /** A validated `<alias>.<column>` reference. */
  private qualified(alias: string, column: string): string {
    return `${this.id(alias)}.${this.id(column)}`;
  }

  private piiGate(requires: readonly Capability[], what: string): void {
    if (requires.includes("pii") && !this.capabilities.has("pii")) {
      throw new VoidQlPiiError({
        message: `${what} is PII and requires elevated access; the query was rejected.`,
      });
    }
  }

  /** Lower a JSON-namespace property access; the key is bound, never spliced (§9). */
  private property(alias: string, sourceColumn: string, key: string): PrintedExpr {
    return {
      pieces: [
        lit(`JSONExtractString(${this.qualified(alias, sourceColumn)}, `),
        par("String", key),
        lit(")"),
      ],
      type: "String",
    };
  }

  private columnOf(rel: ResolvedRelation, name: string): VoidQLType | undefined {
    if (rel.kind === "view") {
      const col = rel.table.columns[name];
      if (!col) return undefined;
      this.piiGate(col.requires, `Column '${name}'`);
      return col.type;
    }
    return rel.columns.get(name);
  }

  private resolveColumn(ref: ColumnRef, frame: Frame): PrintedExpr {
    const chain = ref.chain;
    if (chain.length > 3) {
      throw new VoidQlUnsupportedError({
        message: `Property path '${chain.join(".")}' is too deep.`,
        hint: "",
      });
    }

    // qualified namespace access: <alias>.<namespace>.<key>
    if (chain.length === 3) {
      const rel = this.findRelation(frame, chain[0].toLowerCase());
      if (!rel || rel.kind !== "view") {
        throw new VoidQlUnknownFieldError({
          field: chain.join("."),
          message: `Unknown property path '${chain.join(".")}'.`,
          suggestion: "",
        });
      }
      const ns = rel.table.namespaces[chain[1]];
      if (!ns) {
        throw new VoidQlUnknownFieldError({
          field: `${chain[0]}.${chain[1]}`,
          message: `'${chain[1]}' is not a property namespace on '${rel.table.name}'.`,
          suggestion: nearest(chain[1], Object.keys(rel.table.namespaces)),
        });
      }
      this.piiGate(ns.requires, `Property namespace '${ns.name}'`);
      return this.property(rel.alias, ns.sourceColumn, chain[2]);
    }

    if (chain.length === 2) {
      const [a, b] = chain;
      const rel = this.findRelation(frame, a.toLowerCase());
      if (rel) {
        // <alias>.<column>
        const type = this.columnOf(rel, b);
        if (type) return { pieces: [lit(this.qualified(rel.alias, b))], type };
        if (rel.kind === "view" && rel.table.namespaces[b]) {
          throw new VoidQlUnknownFieldError({
            field: `${a}.${b}`,
            message: `'${b}' is a property namespace; specify a key, e.g. ${b}.<key>.`,
            suggestion: "",
          });
        }
        throw new VoidQlUnknownFieldError({
          field: `${a}.${b}`,
          message: `Unknown column '${b}' on '${a}'.`,
          suggestion: nearest(b, this.relationColumnNames(rel)),
        });
      }
      // unqualified namespace access: <namespace>.<key>
      const nsRel = this.findNamespaceRelation(frame, a);
      if (nsRel) {
        const ns = nsRel.table.namespaces[a]!;
        this.piiGate(ns.requires, `Property namespace '${ns.name}'`);
        return this.property(nsRel.alias, ns.sourceColumn, b);
      }
      throw new VoidQlUnknownFieldError({
        field: `${a}.${b}`,
        message: `Unknown reference '${a}.${b}'.`,
        suggestion: "",
      });
    }

    // bare column name
    const name = chain[0];
    const matches = this.currentRelations(frame).filter((r) =>
      this.relationColumnNames(r).includes(name),
    );
    if (matches.length === 1) {
      const type = this.columnOf(matches[0]!, name)!;
      return { pieces: [lit(this.qualified(matches[0]!.alias, name))], type };
    }
    if (matches.length > 1) {
      throw new VoidQlUnknownFieldError({
        field: name,
        message: `Column '${name}' is ambiguous; qualify it with a table alias.`,
        suggestion: "",
      });
    }
    const aliasType = this.findExpressionAlias(frame, name.toLowerCase());
    if (aliasType) {
      return { pieces: [lit(this.id(name))], type: aliasType };
    }
    const allCols = this.currentRelations(frame).flatMap((r) => this.relationColumnNames(r));
    if (this.findNamespaceRelation(frame, name)) {
      throw new VoidQlUnknownFieldError({
        field: name,
        message: `'${name}' is a property namespace; specify a key, e.g. ${name}.<key>.`,
        suggestion: "",
      });
    }
    throw new VoidQlUnknownFieldError({
      field: name,
      message: `Unknown column '${name}'.`,
      suggestion: nearest(name, allCols),
    });
  }

  private currentRelations(frame: Frame): readonly ResolvedRelation[] {
    return frame.relations;
  }

  private findNamespaceRelation(
    frame: Frame,
    name: string,
  ): { readonly alias: string; readonly table: CatalogTable } | undefined {
    const hits = frame.relations.filter(
      (r): r is Extract<ResolvedRelation, { kind: "view" }> =>
        r.kind === "view" && name in r.table.namespaces,
    );
    return hits.length === 1 ? { alias: hits[0]!.alias, table: hits[0]!.table } : undefined;
  }

  // ── expressions ────────────────────────────────────────────────────────────

  private printExpr(expr: Expr, frame: Frame, expected?: VoidQLType): PrintedExpr {
    switch (expr._tag) {
      case "StringLit": {
        if (expected !== "DateTime") {
          return { pieces: [par("String", expr.value)], type: "String" };
        }
        // A string compared against a DateTime column is coerced to DateTime for
        // partition pruning. Guard the parse: `new Date('not-a-date').toISOString()`
        // throws a raw `RangeError` (not a typed compile error), which would escape
        // as an opaque defect/500 and break the validate-repair loop (§18 #9).
        const parsed = new Date(expr.value);
        if (Number.isNaN(parsed.getTime())) {
          throw new VoidQlSyntaxError({
            message: `'${expr.value}' is not a valid date/time literal.`,
            hint: "Use an ISO-8601 date like '2026-01-01' or '2026-01-01 12:00:00'.",
          });
        }
        return { pieces: [par("DateTime", toClickhouseDateTime(parsed))], type: "DateTime" };
      }
      case "NumberLit": {
        const type =
          expected === "Int64" || expected === "UInt64" || expected === "Float64"
            ? expected
            : expr.numType;
        return { pieces: [par(chParamType(type), expr.value)], type };
      }
      case "BoolLit":
        return { pieces: [par("Bool", expr.value)], type: "Bool" };
      case "NullLit":
        return { pieces: [lit("NULL")], type: expected ?? "String" };
      case "ColumnRef":
        return this.resolveColumn(expr, frame);
      case "StarRef":
        throw new VoidQlUnsupportedError({
          message: "'*' is only allowed as a SELECT item or as count(*).",
          hint: "",
        });
      case "Paren": {
        const inner = this.printExpr(expr.expr, frame, expected);
        return { pieces: [lit("("), ...inner.pieces, lit(")")], type: inner.type };
      }
      case "Unary": {
        const inner = this.printExpr(expr.expr, frame, expr.op === "neg" ? expected : undefined);
        const op = expr.op === "not" ? "NOT " : "-";
        return {
          pieces: [lit(`(${op}`), ...inner.pieces, lit(")")],
          type: expr.op === "not" ? "Bool" : inner.type,
        };
      }
      case "Binary":
        return this.printBinary(expr, frame);
      case "InExpr":
        return this.printIn(expr, frame);
      case "ExistsExpr": {
        const query = this.printQuery(expr.query, frame);
        return { pieces: [lit("EXISTS ( "), ...query.pieces, lit(" )")], type: "Bool" };
      }
      case "SubqueryExpr": {
        const query = this.printQuery(expr.query, frame);
        if (query.shape.length !== 1) {
          throw new VoidQlUnsupportedError({
            message: "A scalar subquery must return exactly one column.",
            hint: "Select one expression in the scalar subquery.",
          });
        }
        return {
          pieces: [lit("( "), ...query.pieces, lit(" )")],
          type: query.shape[0]!.type,
        };
      }
      case "Between": {
        const target = this.printExpr(expr.expr, frame);
        const low = this.printExpr(expr.low, frame, target.type);
        const high = this.printExpr(expr.high, frame, target.type);
        return {
          pieces: [
            lit("("),
            ...target.pieces,
            lit(expr.negated ? " NOT BETWEEN " : " BETWEEN "),
            ...low.pieces,
            lit(" AND "),
            ...high.pieces,
            lit(")"),
          ],
          type: "Bool",
        };
      }
      case "IsNull": {
        const target = this.printExpr(expr.expr, frame);
        return {
          pieces: [lit("("), ...target.pieces, lit(expr.negated ? " IS NOT NULL)" : " IS NULL)")],
          type: "Bool",
        };
      }
      case "CaseExpr":
        return this.printCase(expr, frame);
      case "FnCall":
        return this.printFnCall(expr, frame);
      case "WindowExpr": {
        const fn = this.printFnCall(expr.fn, frame, true);
        const pieces: SqlPiece[] = [...fn.pieces, lit(" OVER (")];
        if (expr.partitionBy.length > 0) {
          pieces.push(lit("PARTITION BY "));
          expr.partitionBy.forEach((partition, index) => {
            if (index > 0) pieces.push(lit(", "));
            pieces.push(...this.printExpr(partition, frame).pieces);
          });
        }
        if (expr.orderBy.length > 0) {
          if (expr.partitionBy.length > 0) pieces.push(lit(" "));
          pieces.push(lit("ORDER BY "));
          expr.orderBy.forEach((order, index) => {
            if (index > 0) pieces.push(lit(", "));
            pieces.push(
              ...this.printExpr(order.expr, frame).pieces,
              lit(order.dir === "desc" ? " DESC" : " ASC"),
            );
            if (order.nulls) {
              pieces.push(lit(order.nulls === "first" ? " NULLS FIRST" : " NULLS LAST"));
            }
          });
        }
        if (expr.frame) {
          if (expr.partitionBy.length > 0 || expr.orderBy.length > 0) pieces.push(lit(" "));
          const bound = (value: typeof expr.frame.start): string => {
            if (value === "unboundedPreceding") return "UNBOUNDED PRECEDING";
            if (value === "unboundedFollowing") return "UNBOUNDED FOLLOWING";
            return "CURRENT ROW";
          };
          pieces.push(lit(expr.frame.unit === "rows" ? "ROWS " : "RANGE "));
          if (expr.frame.end) {
            pieces.push(lit(`BETWEEN ${bound(expr.frame.start)} AND ${bound(expr.frame.end)}`));
          } else {
            pieces.push(lit(bound(expr.frame.start)));
          }
        }
        pieces.push(lit(")"));
        return { pieces, type: fn.type };
      }
    }
  }

  private printBinary(expr: Binary, frame: Frame): PrintedExpr {
    const sqlOp: Record<Binary["op"], string> = {
      or: " OR ",
      and: " AND ",
      eq: " = ",
      neq: " != ",
      lt: " < ",
      lte: " <= ",
      gt: " > ",
      gte: " >= ",
      like: " LIKE ",
      notLike: " NOT LIKE ",
      ilike: " ILIKE ",
      notIlike: " NOT ILIKE ",
      add: " + ",
      sub: " - ",
      mul: " * ",
      div: " / ",
      mod: " % ",
    };
    const isComparison = ["eq", "neq", "lt", "lte", "gt", "gte"].includes(expr.op);
    const isLogical = expr.op === "and" || expr.op === "or";
    const isArith = ["add", "sub", "mul", "div", "mod"].includes(expr.op);

    const left = this.printExpr(expr.left, frame, isComparison ? undefined : undefined);
    // Propagate the left operand's type to a comparison RHS so a string literal
    // compared to a DateTime column binds as DateTime (partition pruning, §18 #9).
    const rhsExpected = isComparison
      ? left.type
      : expr.op === "like" || expr.op === "notLike" || expr.op === "ilike" || expr.op === "notIlike"
        ? "String"
        : undefined;
    const right = this.printExpr(expr.right, frame, rhsExpected);
    const type: VoidQLType =
      isComparison ||
      isLogical ||
      expr.op === "like" ||
      expr.op === "notLike" ||
      expr.op === "ilike" ||
      expr.op === "notIlike"
        ? "Bool"
        : isArith
          ? "Float64"
          : "String";
    return {
      pieces: [lit("("), ...left.pieces, lit(sqlOp[expr.op]), ...right.pieces, lit(")")],
      type,
    };
  }

  private printIn(expr: InExpr, frame: Frame): PrintedExpr {
    const target = this.printExpr(expr.expr, frame);
    const pieces: SqlPiece[] = [
      lit("("),
      ...target.pieces,
      lit(expr.negated ? " NOT IN (" : " IN ("),
    ];
    if (expr.query) {
      const query = this.printQuery(expr.query, frame);
      if (query.shape.length !== 1) {
        throw new VoidQlUnsupportedError({
          message: "An IN subquery must return exactly one column.",
          hint: "Select one expression in the IN subquery.",
        });
      }
      pieces.push(...query.pieces);
    } else {
      expr.list?.forEach((item, i) => {
        if (i > 0) pieces.push(lit(", "));
        pieces.push(...this.printExpr(item, frame, target.type).pieces);
      });
    }
    pieces.push(lit("))"));
    return { pieces, type: "Bool" };
  }

  private printCase(expr: CaseExpr, frame: Frame): PrintedExpr {
    const pieces: SqlPiece[] = [lit("CASE")];
    if (expr.operand) {
      pieces.push(lit(" "), ...this.printExpr(expr.operand, frame).pieces);
    }
    let resultType: VoidQLType = "String";
    expr.whens.forEach((branch, i) => {
      const when = this.printExpr(branch.when, frame);
      const then = this.printExpr(branch.then, frame);
      if (i === 0) resultType = then.type;
      pieces.push(lit(" WHEN "), ...when.pieces, lit(" THEN "), ...then.pieces);
    });
    if (expr.else) {
      pieces.push(lit(" ELSE "), ...this.printExpr(expr.else, frame).pieces);
    }
    pieces.push(lit(" END"));
    return { pieces, type: resultType };
  }

  private printFnCall(expr: FnCall, frame: Frame, inWindow = false): PrintedExpr {
    const spec = lookupFunction(expr.name);
    if (!spec) {
      throw new VoidQlUnsupportedError({
        message: `Unknown or unsupported function '${expr.name}'.`,
        hint: "Only the curated VoidQL function set is available.",
      });
    }
    if (expr.args.length < spec.minArgs || expr.args.length > spec.maxArgs) {
      throw new VoidQlUnsupportedError({
        message: `Function '${expr.name}' expects ${spec.minArgs}..${spec.maxArgs} arguments, got ${expr.args.length}.`,
        hint: "",
      });
    }
    if (spec.windowOnly && !inWindow) {
      throw new VoidQlUnsupportedError({
        message: `Function '${expr.name}' requires an OVER clause.`,
        hint: "Add OVER (...) to make this a window expression.",
      });
    }

    // count(*) is the only place a bare star is admissible.
    if (spec.allowStar && expr.args.length === 1 && expr.args[0]!._tag === "StarRef") {
      return { pieces: [lit(`${spec.chName}(*)`)], type: this.fnReturnType(spec, []) };
    }

    const argResults = expr.args.map((arg) => {
      if (arg._tag === "StarRef") {
        throw new VoidQlUnsupportedError({
          message: `'*' is not a valid argument to '${expr.name}'.`,
          hint: "",
        });
      }
      return this.printExpr(arg, frame);
    });

    const pieces: SqlPiece[] = [lit(`${spec.chName}(`)];
    argResults.forEach((arg, i) => {
      if (i > 0) pieces.push(lit(", "));
      pieces.push(...arg.pieces);
    });
    pieces.push(lit(")"));
    return {
      pieces,
      type: this.fnReturnType(
        spec,
        argResults.map((a) => a.type),
      ),
    };
  }

  private fnReturnType(spec: FnSpec, argTypes: readonly VoidQLType[]): VoidQLType {
    if (typeof spec.returns === "object") {
      return argTypes[spec.returns.arg] ?? "String";
    }
    return spec.returns;
  }

  // ── select ──────────────────────────────────────────────────────────────

  printQuery(query: Query, parent?: Frame): CompiledSelect {
    if (query._tag === "Select") return this.printSelect(query, parent);

    const compiled = query.selects.map((select) => this.printSelect(select, parent));
    const shape = compiled[0]!.shape;
    for (const arm of compiled.slice(1)) {
      const compatible =
        arm.shape.length === shape.length &&
        arm.shape.every((column, index) => column.type === shape[index]!.type);
      if (!compatible) {
        throw new VoidQlUnsupportedError({
          message: "Set-query arms must return the same number of columns with matching types.",
          hint: "Align each SELECT projection before combining them.",
        });
      }
    }
    const unionPieces: SqlPiece[] = [];
    compiled.forEach((arm, index) => {
      if (index > 0) unionPieces.push(lit(` ${query.operators[index - 1]} `));
      unionPieces.push(...arm.pieces);
    });
    const pieces: SqlPiece[] = [lit("SELECT ")];
    shape.forEach((column, index) => {
      if (index > 0) pieces.push(lit(", "));
      pieces.push(lit(`${this.qualified("voidql_union", column.name)} AS ${this.id(column.name)}`));
    });
    pieces.push(
      lit(" FROM ( "),
      ...unionPieces,
      lit(` ) AS voidql_union LIMIT ${MAX_RESULT_ROWS}`),
    );
    return { pieces, shape, injected: [] };
  }

  printSelect(select: Select, parent?: Frame): CompiledSelect {
    const frame: Frame = { relations: [], cteShapes: new Map(), aliases: new Map(), parent };

    const ctePieces: SqlPiece[] = [];
    select.with.forEach((cte, i) => {
      const nameLower = cte.name.toLowerCase();
      if (
        !IDENT_RE.test(cte.name) ||
        PHYSICAL_SHAPED_RE.test(cte.name) ||
        RESERVED_INTERNAL_ALIASES.has(nameLower)
      ) {
        throw new VoidQlUnsupportedError({ message: `Invalid CTE name '${cte.name}'.`, hint: "" });
      }
      if (frame.cteShapes.has(nameLower)) {
        throw new VoidQlUnsupportedError({ message: `Duplicate CTE '${cte.name}'.`, hint: "" });
      }
      const compiled = this.printQuery(cte.query, frame);
      frame.cteShapes.set(nameLower, compiled.shape);
      ctePieces.push(
        lit(i === 0 ? "WITH " : ", "),
        lit(`${cte.name} AS ( `),
        ...compiled.pieces,
        lit(" )"),
      );
    });
    if (ctePieces.length > 0) ctePieces.push(lit(" "));

    // FROM + JOINs build the relation frame before any expression is resolved.
    const fromPieces = select.from ? this.resolveSource(select.from, frame) : [];
    const joinPieces: SqlPiece[] = [];
    for (const join of select.joins) {
      const relationCountBeforeJoin = frame.relations.length;
      const sourcePieces = this.resolveSource(join.source, frame);
      const kindSql =
        join.kind === "left"
          ? " LEFT JOIN "
          : join.kind === "right"
            ? " RIGHT JOIN "
            : join.kind === "full"
              ? " FULL JOIN "
              : join.kind === "cross"
                ? " CROSS JOIN "
                : " INNER JOIN ";
      joinPieces.push(lit(kindSql), ...sourcePieces);
      if (join.on) {
        joinPieces.push(lit(" ON "), ...this.printExpr(join.on, frame, "Bool").pieces);
      } else if (join.using) {
        for (const column of join.using) {
          const leftMatches = frame.relations
            .slice(0, relationCountBeforeJoin)
            .filter((relation) => this.relationColumnNames(relation).includes(column));
          const rightMatches = frame.relations
            .slice(relationCountBeforeJoin)
            .filter((relation) => this.relationColumnNames(relation).includes(column));
          if (leftMatches.length === 0 || rightMatches.length === 0) {
            throw new VoidQlUnknownFieldError({
              field: column,
              message: `USING column '${column}' must exist on both sides of the join.`,
              suggestion: "",
            });
          }
          [...leftMatches, ...rightMatches].forEach((relation) => this.columnOf(relation, column));
        }
        joinPieces.push(lit(` USING (${join.using.map((column) => this.id(column)).join(", ")})`));
      }
    }

    const { columnPieces, shape } = this.printColumns(select.columns, frame);

    const pieces: SqlPiece[] = [
      ...ctePieces,
      lit(select.distinct ? "SELECT DISTINCT" : "SELECT"),
      ...(select.distinctOn.length > 0
        ? [
            lit(" ON ("),
            ...select.distinctOn.flatMap((expr, index) => [
              ...(index > 0 ? [lit(", ")] : []),
              ...this.printExpr(expr, frame).pieces,
            ]),
            lit(")"),
          ]
        : []),
      lit(" "),
      ...columnPieces,
      ...(select.from ? [lit(" FROM "), ...fromPieces] : []),
      ...joinPieces,
    ];

    if (select.prewhere || select.where) {
      pieces.push(lit(" WHERE "));
      if (select.prewhere) {
        pieces.push(...this.printExpr(select.prewhere, frame, "Bool").pieces);
      }
      if (select.prewhere && select.where) pieces.push(lit(" AND "));
      if (select.where) pieces.push(...this.printExpr(select.where, frame, "Bool").pieces);
    }
    if (select.groupBy.length > 0) {
      pieces.push(lit(" GROUP BY "));
      select.groupBy.forEach((g, i) => {
        if (i > 0) pieces.push(lit(", "));
        pieces.push(...this.printExpr(g, frame).pieces);
      });
      if (select.groupByModifier) {
        pieces.push(lit(select.groupByModifier === "rollup" ? " WITH ROLLUP" : " WITH CUBE"));
      }
      if (select.withTotals) pieces.push(lit(" WITH TOTALS"));
    }
    if (select.having) {
      pieces.push(lit(" HAVING "), ...this.printExpr(select.having, frame, "Bool").pieces);
    }
    if (select.qualify) {
      pieces.push(lit(" QUALIFY "), ...this.printExpr(select.qualify, frame, "Bool").pieces);
    }
    if (select.orderBy.length > 0) {
      pieces.push(lit(" ORDER BY "));
      select.orderBy.forEach((o: OrderItem, i) => {
        if (i > 0) pieces.push(lit(", "));
        pieces.push(
          ...this.printExpr(o.expr, frame).pieces,
          lit(o.dir === "desc" ? " DESC" : " ASC"),
        );
        if (o.nulls) pieces.push(lit(o.nulls === "first" ? " NULLS FIRST" : " NULLS LAST"));
      });
    }

    if (select.limitBy) {
      pieces.push(lit(` LIMIT ${select.limitBy.limit}`));
      if (select.limitBy.offset && select.limitBy.offset > 0) {
        pieces.push(lit(` OFFSET ${select.limitBy.offset}`));
      }
      pieces.push(lit(" BY "));
      select.limitBy.by.forEach((expr, index) => {
        if (index > 0) pieces.push(lit(", "));
        pieces.push(...this.printExpr(expr, frame).pieces);
      });
    }

    // LIMIT is always emitted and clamped — defense-in-depth (§7 L6).
    const limit = Math.min(select.limit ?? MAX_RESULT_ROWS, MAX_RESULT_ROWS);
    pieces.push(lit(` LIMIT ${limit}`));
    if (select.offset && select.offset > 0) pieces.push(lit(` OFFSET ${select.offset}`));
    if (select.withTies) {
      if (select.orderBy.length === 0) {
        throw new VoidQlUnsupportedError({
          message: "LIMIT WITH TIES requires ORDER BY.",
          hint: "Add ORDER BY before LIMIT WITH TIES.",
        });
      }
      pieces.push(lit(" WITH TIES"));
    }

    return { pieces, shape, injected: [] };
  }

  private printColumns(
    columns: readonly SelectItem[],
    frame: Frame,
  ): { readonly columnPieces: readonly SqlPiece[]; readonly shape: readonly ColumnSpec[] } {
    const columnPieces: SqlPiece[] = [];
    const shape: ColumnSpec[] = [];
    const outputNames = new Set<string>();
    let emitted = 0;

    const emitSep = () => {
      if (emitted > 0) columnPieces.push(lit(", "));
      emitted += 1;
    };

    columns.forEach((item, index) => {
      if (item.expr._tag === "StarRef") {
        this.expandStar(item.expr.qualifier, frame).forEach((entry) => {
          if (outputNames.has(entry.col.toLowerCase())) {
            throw new VoidQlUnsupportedError({
              message: `Duplicate output column '${entry.col}'.`,
              hint: "Select and alias columns explicitly when relations share names.",
            });
          }
          outputNames.add(entry.col.toLowerCase());
          emitSep();
          columnPieces.push(lit(this.qualified(entry.alias, entry.col)));
          shape.push({ name: entry.col, type: entry.type });
        });
        return;
      }
      const printed = this.printExpr(item.expr, frame);
      emitSep();
      columnPieces.push(...printed.pieces);
      const name = item.alias ?? this.inferColumnName(item, index);
      // Always emit an explicit `AS <name>` — including for synthesized names — so
      // the ClickHouse output column name equals the reported `shape` name. Without
      // it, an unaliased computed column (count(), CASE, arithmetic) is CH-named by
      // its expression while `shape` reports `expr_N`, so the caller reads the wrong
      // key (silent wrong result) and a subquery/CTE reference to it fails to resolve.
      if (
        !IDENT_RE.test(name) ||
        PHYSICAL_SHAPED_RE.test(name) ||
        RESERVED_INTERNAL_ALIASES.has(name.toLowerCase())
      ) {
        throw new VoidQlUnsupportedError({ message: `Invalid column alias '${name}'.`, hint: "" });
      }
      if (outputNames.has(name.toLowerCase())) {
        throw new VoidQlUnsupportedError({
          message: `Duplicate output column '${name}'.`,
          hint: "Give every selected expression a unique alias.",
        });
      }
      outputNames.add(name.toLowerCase());
      columnPieces.push(lit(` AS ${name}`));
      shape.push({ name, type: printed.type });
      frame.aliases.set(name.toLowerCase(), printed.type);
    });

    return { columnPieces, shape };
  }

  private inferColumnName(item: SelectItem, index: number): string {
    if (item.expr._tag === "ColumnRef") {
      const last = item.expr.chain[item.expr.chain.length - 1]!;
      return last;
    }
    return `expr_${index}`;
  }

  private expandStar(
    qualifier: string | undefined,
    frame: Frame,
  ): readonly { readonly alias: string; readonly col: string; readonly type: VoidQLType }[] {
    const relations = qualifier
      ? [this.findRelation(frame, qualifier.toLowerCase())].filter(
          (r): r is ResolvedRelation => r !== undefined,
        )
      : frame.relations;
    if (qualifier && relations.length === 0) {
      throw new VoidQlUnknownFieldError({
        field: `${qualifier}.*`,
        message: `Unknown table '${qualifier}' in '${qualifier}.*'.`,
        suggestion: "",
      });
    }
    return relations.flatMap((rel) => {
      if (rel.kind === "view") {
        return Object.values(rel.table.columns)
          .filter((c) => c.inStar)
          .map((c) => ({ alias: rel.alias, col: c.name, type: c.type }));
      }
      return [...rel.columns.entries()].map(([col, type]) => ({ alias: rel.alias, col, type }));
    });
  }
}

/**
 * Resolve + print a parsed statement into the {@link CompiledSelect} IR. Throws the
 * typed compile errors (`VoidQlSchemaError`, `VoidQlUnknownFieldError`,
 * `VoidQlPiiError`, `VoidQlUnsupportedError`).
 */
export const compileSelect = (
  select: Query,
  scope: AuthorizedScope,
  capabilities: ReadonlySet<Capability>,
): CompiledSelect => {
  const compiler = new Compiler(scope, capabilities);
  const result = compiler.printQuery(select);
  return { pieces: result.pieces, shape: result.shape, injected: compiler.injected };
};
