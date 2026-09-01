import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
/*
 * Recursive-descent parsers use exceptions as their non-local exit: a bad token
 * anywhere in the descent must unwind straight out of the nested `parse*`
 * frames. Throwing is therefore the control flow of this entire module, not an
 * escape hatch at a few sites. `compile.ts` is the single Effect boundary that
 * converts these tagged VoidQL errors back into typed failures; routing them
 * through Effect here would surface every compile error as an opaque defect and
 * force each of the ~60 mutually recursive methods to become an Effect.
 */
/**
 * The VoidQL parser — hand-written recursive descent with a Pratt
 * (precedence-climbing) expression core with no `eval` or platform dependencies.
 *
 * This module is the **sole, trusted constructor of AST nodes**: no other
 * module is permitted to build a node literal, which is what makes "user text
 * never reaches `ch.literal`" a static property rather than an assumption.
 *
 * Depth / node / join / subquery caps live **in the cursor**, checked *before*
 * recursion, so a 10⁵-deep input is a typed {@link VoidQlComplexityError}, not a
 * JS-stack blow-up. Deferred and denied constructs (`SETTINGS`,
 * `ARRAY JOIN`, named windows, …) have no production at all — they are parse
 * errors, never parse-then-reject, so the highest-risk surface never has a
 * validator to bypass.
 */
import { constant, numberOr, stringOr } from "@voidhash/lib/lang";

import type {
  Binary,
  BinaryOp,
  CaseWhen,
  Cte,
  Expr,
  FnCall,
  Join,
  OrderItem,
  Pos,
  Query,
  Select,
  SelectItem,
  SetOperator,
  Span,
  Statement,
  TableSource,
  WindowFrame,
  WindowFrameBound,
} from "./ast/VoidQlAst.ts";
import { VoidQlComplexityError, VoidQlSyntaxError, VoidQlUnsupportedError } from "./errors.ts";
import { isForbiddenKeyword, lex, type Token } from "./lexer.ts";

const FALLBACK_EOF_TOKEN: Token = {
  end: { col: 1, line: 1, offset: 0 },
  kind: "eof",
  start: { col: 1, line: 1, offset: 0 },
  text: "",
};

const LIMITS = constant({
  maxDepth: 50,
  maxNodes: 20_000,
  maxJoins: 8,
  maxSubqueries: 16,
});

class Cursor {
  private index = 0;
  private depth = 0;
  private nodeCount = 0;
  private joinCount = 0;
  private subqueryCount = 0;
  private readonly tokens: readonly Token[];

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  // ── token access ──────────────────────────────────────────────────────────

  private peek(ahead = 0): Token {
    return this.tokens[Math.min(this.index + ahead, this.tokens.length - 1)] ?? FALLBACK_EOF_TOKEN;
  }

  private prev(): Token {
    return this.tokens[Math.max(this.index - 1, 0)] ?? FALLBACK_EOF_TOKEN;
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== "eof") this.index += 1;
    return token;
  }

  private isOp(text: string): boolean {
    const t = this.peek();
    return t.kind === "op" && t.text === text;
  }

  private isKw(text: string): boolean {
    const t = this.peek();
    return t.kind === "kw" && t.text === text;
  }

  private eatOp(text: string): boolean {
    if (this.isOp(text)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private eatKw(text: string): boolean {
    if (this.isKw(text)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private fail(token: Token, message: string, hint = ""): never {
    throw new VoidQlSyntaxError({
      message: `line ${token.start.line}, col ${token.start.col}: ${message}`,
      hint,
    });
  }

  private expectOp(text: string): void {
    if (!this.eatOp(text)) this.fail(this.peek(), `Expected '${text}'.`);
  }

  private expectKw(text: string): void {
    if (!this.eatKw(text)) this.fail(this.peek(), `Expected '${text.toUpperCase()}'.`);
  }

  private expectIdent(what: string): string {
    const t = this.peek();
    if (t.kind !== "ident") this.fail(t, `Expected ${what}.`);
    this.index += 1;
    return t.text;
  }

  private span(start: Pos): Span {
    return { start, end: this.prev().end };
  }

  /**
   * Increment the node counter and fail closed past the cap. Every node literal
   * is stamped through here, so the bound is enforced at construction.
   */
  private count(): void {
    this.nodeCount += 1;
    if (this.nodeCount > LIMITS.maxNodes) {
      throw new VoidQlComplexityError({ message: "Query has too many elements." });
    }
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > LIMITS.maxDepth) {
      throw new VoidQlComplexityError({ message: "Query is nested too deeply." });
    }
  }

  private leave(): void {
    this.depth -= 1;
  }

  /**
   * Reject deferred/denied keywords with a teachable message before they can be
   * mis-parsed as the start of an expression.
   */
  private forbiddenHint(text: string): string {
    if (text === "settings" || text === "set") {
      return "VoidQL does not support a SETTINGS clause; tenant scope is applied automatically and cannot be set in a query.";
    }
    return `VoidQL is a read-only subset; '${text.toUpperCase()}' is not part of the dialect.`;
  }

  /**
   * Runs `production` when `keyword` is the next token, otherwise yields
   * `undefined` — the optional-clause shape shared by FROM/WHERE/HAVING/….
   */
  private after<A>(keyword: string, production: () => A): A | typeof Schema.Undefined.Type {
    if (this.eatKw(keyword)) {
      return production();
    }
    return undefined;
  }

  private guardForbidden(): void {
    const t = this.peek();
    if (t.kind === "kw" && isForbiddenKeyword(t.text)) {
      const hint = this.forbiddenHint(t.text);
      throw new VoidQlUnsupportedError({
        message: `line ${t.start.line}, col ${t.start.col}: Unsupported keyword '${t.text.toUpperCase()}'.`,
        hint,
      });
    }
  }

  // ── statement ──────────────────────────────────────────────────────────────

  parseStatement(): Statement {
    const query = this.parseQuery();
    this.eatOp(";");
    const tail = this.peek();
    if (tail.kind !== "eof") {
      // A trailing token after a complete SELECT is almost always a denied clause
      // (e.g. `… SETTINGS x=1` or `… FORMAT JSON`).
      this.guardForbidden();
      this.fail(tail, `Unexpected '${tail.text || tail.kind}' after end of query.`);
    }
    return query;
  }

  private parseSetOperator(): SetOperator {
    if (this.eatKw("union")) {
      if (this.eatKw("all")) return "UNION ALL";
      if (this.eatKw("distinct")) return "UNION DISTINCT";
      throw new VoidQlUnsupportedError({
        message: `line ${this.peek().start.line}, col ${this.peek().start.col}: UNION requires ALL or DISTINCT.`,
        hint: "Specify UNION ALL or UNION DISTINCT explicitly.",
      });
    }
    if (this.eatKw("intersect")) {
      this.eatKw("distinct");
      return "INTERSECT";
    }
    this.expectKw("except");
    this.eatKw("distinct");
    return "EXCEPT";
  }

  private parseQuery(): Query {
    const first = this.parseSelect();
    // Operator/select pairs, so the non-empty tuple shapes SetQuery requires fall
    // out of the parse instead of needing an assertion.
    const tail: Array<{ readonly operator: SetOperator; readonly select: Select }> = [];
    const parseTail = (): void => {
      if (!this.isKw("union") && !this.isKw("intersect") && !this.isKw("except")) return;
      const operator = this.parseSetOperator();
      tail.push({ operator, select: this.parseSelect() });
      parseTail();
    };
    parseTail();
    const [head, ...rest] = tail;
    if (head === undefined) return first;
    const operators = [head.operator, ...rest.map((entry) => entry.operator)];
    if (HashSet.size(HashSet.fromIterable(operators)) > 1) {
      // VoidQL type-checks a left fold, but ClickHouse binds INTERSECT/EXCEPT
      // tighter than UNION; emitting the arms unparenthesized would execute a
      // different tree than the one that was checked. Mixed chains are rejected
      // so the executed SQL always matches VoidQL's semantics.
      throw new VoidQlUnsupportedError({
        message: "Mixed set operators (UNION / INTERSECT / EXCEPT) are not supported.",
        hint: "Chain a single operator type, or nest each grouping in a subquery to force evaluation order.",
      });
    }
    this.count();
    const [firstOperator, ...remainingOperators] = operators;
    return {
      _tag: "SetQuery",
      selects: [first, head.select, ...rest.map((entry) => entry.select)],
      operators: [firstOperator, ...remainingOperators],
      span: {
        start: first.span.start,
        end: Option.getOrElse(Arr.last(tail), () => head).select.span.end,
      },
    };
  }

  private parseSelect(): Select {
    this.enter();
    const start = this.peek().start;

    const ctes: Cte[] = [];
    if (this.eatKw("with")) {
      const parseCte = (): void => {
        const cteStart = this.peek().start;
        const name = this.expectIdent("a CTE name");
        this.expectKw("as");
        this.expectOp("(");
        const query = this.parseQuery();
        this.expectOp(")");
        this.count();
        ctes.push({ _tag: "Cte", name, query, span: this.span(cteStart) });
        if (this.eatOp(",")) parseCte();
      };
      parseCte();
    }

    this.guardForbidden(); // a leading denied keyword (DROP/INSERT/…) → teachable error
    this.expectKw("select");
    const distinct = this.eatKw("distinct");
    const distinctOn: Expr[] = [];
    if (distinct && this.eatKw("on")) {
      this.expectOp("(");
      distinctOn.push(this.parseExpr(0));
      const parseDistinctOn = (): void => {
        if (!this.eatOp(",")) return;
        distinctOn.push(this.parseExpr(0));
        parseDistinctOn();
      };
      parseDistinctOn();
      this.expectOp(")");
    } else if (!distinct) {
      this.eatKw("all");
    }
    this.guardForbidden();

    const columns: [SelectItem, ...SelectItem[]] = [this.parseSelectItem()];
    const parseColumns = (): void => {
      if (!this.eatOp(",")) return;
      columns.push(this.parseSelectItem());
      parseColumns();
    };
    parseColumns();

    const from = this.after("from", () => this.parseTableSource());

    const joins: Join[] = [];
    if (from) {
      const parseJoins = (): void => {
        const join = this.tryParseJoin();
        if (!join) return;
        if (joins.length >= LIMITS.maxJoins) {
          throw new VoidQlComplexityError({ message: "Query has too many joins." });
        }
        joins.push(join);
        parseJoins();
      };
      parseJoins();
    }

    const prewhere = this.after("prewhere", () => this.parseExpr(0));
    const where = this.after("where", () => this.parseExpr(0));

    const groupBy: Expr[] = [];
    if (this.eatKw("group")) {
      this.expectKw("by");
      groupBy.push(this.parseExpr(0));
      const parseGroupBy = (): void => {
        if (!this.eatOp(",")) return;
        groupBy.push(this.parseExpr(0));
        parseGroupBy();
      };
      parseGroupBy();
    }
    let groupByModifier: Select["groupByModifier"];
    let withTotals = false;
    if (Arr.isReadonlyArrayNonEmpty(groupBy)) {
      const parseGroupModifier = (): void => {
        if (!this.eatKw("with")) return;
        if (this.eatKw("rollup")) groupByModifier = "rollup";
        else if (this.eatKw("cube")) groupByModifier = "cube";
        else if (this.eatKw("totals")) withTotals = true;
        else this.fail(this.peek(), "Expected ROLLUP, CUBE, or TOTALS after WITH.");
        parseGroupModifier();
      };
      parseGroupModifier();
    }

    const having = this.after("having", () => this.parseExpr(0));
    const qualify = this.after("qualify", () => this.parseExpr(0));

    const orderBy: OrderItem[] = [];
    if (this.eatKw("order")) {
      this.expectKw("by");
      orderBy.push(this.parseOrderItem());
      const parseOrderBy = (): void => {
        if (!this.eatOp(",")) return;
        orderBy.push(this.parseOrderItem());
        parseOrderBy();
      };
      parseOrderBy();
    }

    let limitBy: Select["limitBy"];
    let limit: number | typeof Schema.Undefined.Type;
    let offset: number | typeof Schema.Undefined.Type;
    let withTies = false;
    if (this.eatKw("limit")) {
      const first = this.parseUintLiteral("a LIMIT count");
      let second: number | typeof Schema.Undefined.Type;
      if (this.eatOp(",")) second = this.parseUintLiteral("a LIMIT count after the offset");
      if (this.eatKw("by")) {
        const by: [Expr, ...Expr[]] = [this.parseExpr(0)];
        const parseLimitBy = (): void => {
          if (!this.eatOp(",")) return;
          by.push(this.parseExpr(0));
          parseLimitBy();
        };
        parseLimitBy();
        // `LIMIT n, m BY …` puts the offset first; `LIMIT n BY …` has none.
        let byOffset: number | typeof Schema.Undefined.Type;
        if (second !== undefined) byOffset = first;
        limitBy = {
          limit: second ?? first,
          offset: byOffset,
          by,
        };
        if (this.eatKw("limit")) {
          const finalFirst = this.parseUintLiteral("a LIMIT count");
          if (this.eatOp(",")) {
            offset = finalFirst;
            limit = this.parseUintLiteral("a LIMIT count after the offset");
          } else {
            limit = finalFirst;
            if (this.eatKw("offset")) offset = this.parseUintLiteral("an OFFSET count");
          }
        }
      } else if (second !== undefined) {
        offset = first;
        limit = second;
      } else {
        limit = first;
        if (this.eatKw("offset")) offset = this.parseUintLiteral("an OFFSET count");
      }
    }
    if (limit !== undefined && this.eatKw("with")) {
      this.expectKw("ties");
      withTies = true;
    }

    this.count();
    this.leave();
    return {
      _tag: "Select",
      with: ctes,
      distinct,
      distinctOn,
      columns,
      from,
      joins,
      prewhere,
      where,
      groupBy,
      groupByModifier,
      withTotals,
      having,
      qualify,
      orderBy,
      limitBy,
      limit,
      offset,
      withTies,
      span: this.span(start),
    };
  }

  private parseUintLiteral(what: string): number {
    const t = this.peek();
    const value = t.value;
    if (t.kind !== "number" || t.numType !== "Int64" || !P.isNumber(value) || value < 0) {
      this.fail(t, `Expected ${what} (a non-negative integer).`);
    }
    this.index += 1;
    return value;
  }

  private parseSelectItem(): SelectItem {
    const start = this.peek().start;
    const expr = this.parseExpr(0);
    let alias: string | typeof Schema.Undefined.Type;
    if (this.eatKw("as")) {
      alias = this.expectIdent("a column alias");
    } else if (this.peek().kind === "ident") {
      alias = this.next().text;
    }
    this.count();
    return { _tag: "SelectItem", expr, alias, span: this.span(start) };
  }

  private parseOrderItem(): OrderItem {
    const start = this.peek().start;
    const expr = this.parseExpr(0);
    let dir: "asc" | "desc" = "asc";
    if (this.eatKw("asc")) dir = "asc";
    else if (this.eatKw("desc")) dir = "desc";
    let nulls: OrderItem["nulls"];
    if (this.eatKw("nulls")) {
      if (this.eatKw("first")) nulls = "first";
      else if (this.eatKw("last")) nulls = "last";
      else this.fail(this.peek(), "Expected FIRST or LAST after NULLS.");
    }
    this.count();
    return { _tag: "OrderItem", expr, dir, nulls, span: this.span(start) };
  }

  private tryParseJoin(): Join | typeof Schema.Undefined.Type {
    let kind: Join["kind"];
    if (this.isKw("inner")) {
      this.next();
      kind = "inner";
      this.expectKw("join");
    } else if (this.isKw("left")) {
      this.next();
      kind = "left";
      this.eatKw("outer");
      this.expectKw("join");
    } else if (this.isKw("right")) {
      this.next();
      kind = "right";
      this.eatKw("outer");
      this.expectKw("join");
    } else if (this.isKw("full")) {
      this.next();
      kind = "full";
      this.eatKw("outer");
      this.expectKw("join");
    } else if (this.isKw("cross")) {
      this.next();
      kind = "cross";
      this.expectKw("join");
    } else if (this.isKw("join")) {
      this.next();
      kind = "inner";
    } else {
      return undefined;
    }
    const start = this.prev().start;
    const source = this.parseTableSource();
    let on: Expr | typeof Schema.Undefined.Type;
    let using: [string, ...string[]] | typeof Schema.Undefined.Type;
    if (kind !== "cross") {
      if (this.eatKw("on")) {
        on = this.parseExpr(0);
      } else if (this.eatKw("using")) {
        const parenthesized = this.eatOp("(");
        using = [this.expectIdent("a column name in USING")];
        const parseUsingTail = (): void => {
          if (!this.eatOp(",")) return;
          using?.push(this.expectIdent("a column name in USING"));
          parseUsingTail();
        };
        parseUsingTail();
        if (parenthesized) this.expectOp(")");
      } else {
        this.fail(this.peek(), "Expected 'ON' or 'USING' after JOIN source.");
      }
    }
    this.count();
    return {
      _tag: "Join",
      kind,
      source,
      on,
      using,
      span: this.span(start),
    };
  }

  private parseTableSource(): TableSource {
    const start = this.peek().start;
    if (this.eatOp("(")) {
      if (++this.subqueryCount > LIMITS.maxSubqueries) {
        throw new VoidQlComplexityError({ message: "Query has too many subqueries." });
      }
      if (!this.isKw("select") && !this.isKw("with")) {
        this.fail(this.peek(), "Expected a subquery (SELECT …) after '('.");
      }
      const query = this.parseQuery();
      this.expectOp(")");
      this.eatKw("as");
      const alias = this.expectIdent("an alias for the subquery (subqueries must be aliased)");
      this.count();
      return { _tag: "SubquerySource", query, alias, span: this.span(start) };
    }
    this.guardForbidden(); // a forbidden keyword in FROM position (e.g. a table fn name shaped like a kw)
    const name = this.expectIdent("a table name");
    let alias: string | typeof Schema.Undefined.Type;
    if (this.eatKw("as")) alias = this.expectIdent("a table alias");
    else if (this.peek().kind === "ident") alias = this.next().text;
    this.count();
    return { _tag: "NamedTable", name, alias, span: this.span(start) };
  }

  // ── expressions (Pratt) ──────────────────────────────────────────────────

  parseExpr(minPrec: number): Expr {
    this.enter();
    const parseTail = (left: Expr): Expr => {
      const next = this.parseInfix(left, minPrec);
      return next === undefined ? left : parseTail(next);
    };
    const left = parseTail(this.parsePrefix());
    this.leave();
    return left;
  }

  private mkBinary(op: BinaryOp, left: Expr, right: Expr, start: Pos): Binary {
    this.count();
    return { _tag: "Binary", op, left, right, span: this.span(start) };
  }

  /** One infix step; returns `undefined` to stop the precedence loop. */
  private parseInfix(left: Expr, minPrec: number): Expr | typeof Schema.Undefined.Type {
    const t = this.peek();
    const start = left.span.start;

    // keyword infix operators sit at comparison precedence (3)
    if (3 > minPrec && t.kind === "kw") {
      if (t.text === "in") {
        this.next();
        return this.parseInTail(left, false, start);
      }
      if (t.text === "between") {
        this.next();
        return this.parseBetweenTail(left, false, start);
      }
      if (t.text === "like") {
        this.next();
        return this.mkBinary("like", left, this.parseExpr(3), start);
      }
      if (t.text === "ilike") {
        this.next();
        return this.mkBinary("ilike", left, this.parseExpr(3), start);
      }
      if (t.text === "is") {
        this.next();
        const negated = this.eatKw("not");
        this.expectKw("null");
        this.count();
        return { _tag: "IsNull", expr: left, negated, span: this.span(start) };
      }
      if (t.text === "not" && this.peek(1).kind === "kw") {
        const follow = this.peek(1).text;
        if (follow === "in") {
          this.next();
          this.next();
          return this.parseInTail(left, true, start);
        }
        if (follow === "between") {
          this.next();
          this.next();
          return this.parseBetweenTail(left, true, start);
        }
        if (follow === "like") {
          this.next();
          this.next();
          return this.mkBinary("notLike", left, this.parseExpr(3), start);
        }
        if (follow === "ilike") {
          this.next();
          this.next();
          return this.mkBinary("notIlike", left, this.parseExpr(3), start);
        }
      }
    }

    if (t.kind === "kw" && t.text === "or" && 1 > minPrec) {
      this.next();
      return this.mkBinary("or", left, this.parseExpr(1), start);
    }
    if (t.kind === "kw" && t.text === "and" && 2 > minPrec) {
      this.next();
      return this.mkBinary("and", left, this.parseExpr(2), start);
    }

    if (t.kind === "op") {
      const cmp: Record<string, BinaryOp> = {
        "=": "eq",
        "!=": "neq",
        "<": "lt",
        "<=": "lte",
        ">": "gt",
        ">=": "gte",
      };
      const comparison = cmp[t.text];
      if (comparison && 3 > minPrec) {
        this.next();
        return this.mkBinary(comparison, left, this.parseExpr(3), start);
      }
      if (t.text === "+" && 4 > minPrec) {
        this.next();
        return this.mkBinary("add", left, this.parseExpr(4), start);
      }
      if (t.text === "-" && 4 > minPrec) {
        this.next();
        return this.mkBinary("sub", left, this.parseExpr(4), start);
      }
      if (t.text === "*" && 5 > minPrec) {
        this.next();
        return this.mkBinary("mul", left, this.parseExpr(5), start);
      }
      if (t.text === "/" && 5 > minPrec) {
        this.next();
        return this.mkBinary("div", left, this.parseExpr(5), start);
      }
      if (t.text === "%" && 5 > minPrec) {
        this.next();
        return this.mkBinary("mod", left, this.parseExpr(5), start);
      }
    }

    return undefined;
  }

  private parseInTail(left: Expr, negated: boolean, start: Pos): Expr {
    this.expectOp("(");
    if (this.isKw("select") || this.isKw("with")) {
      const query = this.parseQuery();
      this.expectOp(")");
      this.count();
      return { _tag: "InExpr", expr: left, query, negated, span: this.span(start) };
    }
    const list: [Expr, ...Expr[]] = [this.parseExpr(0)];
    const parseListTail = (): void => {
      if (!this.eatOp(",")) return;
      list.push(this.parseExpr(0));
      parseListTail();
    };
    parseListTail();
    this.expectOp(")");
    this.count();
    return {
      _tag: "InExpr",
      expr: left,
      list,
      negated,
      span: this.span(start),
    };
  }

  private parseBetweenTail(left: Expr, negated: boolean, start: Pos): Expr {
    const low = this.parseExpr(3);
    this.expectKw("and");
    const high = this.parseExpr(3);
    this.count();
    return { _tag: "Between", expr: left, low, high, negated, span: this.span(start) };
  }

  private parsePrefix(): Expr {
    this.guardForbidden();
    const t = this.peek();
    const start = t.start;

    if (t.kind === "kw") {
      if (t.text === "not") {
        this.next();
        this.count();
        return { _tag: "Unary", op: "not", expr: this.parseExpr(2), span: this.span(start) };
      }
      if (t.text === "true" || t.text === "false") {
        this.next();
        this.count();
        return { _tag: "BoolLit", value: t.text === "true", span: this.span(start) };
      }
      if (t.text === "null") {
        this.next();
        this.count();
        return { _tag: "NullLit", span: this.span(start) };
      }
      if (t.text === "case") return this.parseCase();
      if (t.text === "exists") {
        this.next();
        this.expectOp("(");
        if (!this.isKw("select") && !this.isKw("with")) {
          this.fail(this.peek(), "EXISTS requires a SELECT subquery.");
        }
        const query = this.parseQuery();
        this.expectOp(")");
        this.count();
        return { _tag: "ExistsExpr", query, span: this.span(start) };
      }
      this.fail(t, `Unexpected keyword '${t.text.toUpperCase()}'.`);
    }

    if (t.kind === "op") {
      if (t.text === "-") {
        this.next();
        this.count();
        // Depth-guard the prefix recursion: unlike `not` (which recurses through
        // `parseExpr`), `neg` recurses `parsePrefix` directly, so without enter()/
        // leave() a long `- - … - x` chain is bounded only by maxNodes (20k) and
        // blows the JS stack with a raw RangeError before that cap fires.
        this.enter();
        const operand = this.parsePrefix();
        this.leave();
        return { _tag: "Unary", op: "neg", expr: operand, span: this.span(start) };
      }
      if (t.text === "(") {
        this.next();
        if (this.isKw("select") || this.isKw("with")) {
          const query = this.parseQuery();
          this.expectOp(")");
          this.count();
          return { _tag: "SubqueryExpr", query, span: this.span(start) };
        }
        const expr = this.parseExpr(0);
        this.expectOp(")");
        this.count();
        return { _tag: "Paren", expr, span: this.span(start) };
      }
      if (t.text === "*") {
        this.next();
        this.count();
        return { _tag: "StarRef", span: this.span(start) };
      }
      this.fail(t, `Unexpected '${t.text}'.`);
    }

    if (t.kind === "string") {
      this.next();
      this.count();
      return { _tag: "StringLit", value: stringOr(t.value, ""), span: this.span(start) };
    }

    if (t.kind === "number") {
      this.next();
      this.count();
      return {
        _tag: "NumberLit",
        value: numberOr(t.value, 0),
        numType: t.numType ?? "Int64",
        span: this.span(start),
      };
    }

    if (t.kind === "ident") {
      // function call vs column reference
      if (this.peek(1).kind === "op" && this.peek(1).text === "(") {
        return this.parseFnCall();
      }
      return this.parseColumnRef();
    }

    this.fail(t, "Expected an expression.");
  }

  private parseFnCall(): Expr {
    const start = this.peek().start;
    const name = this.next().text;
    this.expectOp("(");
    const args: Expr[] = [];
    if (!this.isOp(")")) {
      args.push(this.parseExpr(0));
      const parseArgsTail = (): void => {
        if (!this.eatOp(",")) return;
        args.push(this.parseExpr(0));
        parseArgsTail();
      };
      parseArgsTail();
    }
    this.expectOp(")");
    this.count();
    const fn: FnCall = { _tag: "FnCall", name, args, span: this.span(start) };
    if (!this.eatKw("over")) return fn;

    this.expectOp("(");
    const partitionBy: Expr[] = [];
    if (this.eatKw("partition")) {
      this.expectKw("by");
      partitionBy.push(this.parseExpr(0));
      const parsePartitionTail = (): void => {
        if (!this.eatOp(",")) return;
        partitionBy.push(this.parseExpr(0));
        parsePartitionTail();
      };
      parsePartitionTail();
    }
    const orderBy: OrderItem[] = [];
    if (this.eatKw("order")) {
      this.expectKw("by");
      orderBy.push(this.parseOrderItem());
      const parseOrderTail = (): void => {
        if (!this.eatOp(",")) return;
        orderBy.push(this.parseOrderItem());
        parseOrderTail();
      };
      parseOrderTail();
    }
    let frame: WindowFrame | typeof Schema.Undefined.Type;
    const unit = this.tryParseWindowUnit();
    if (unit !== undefined) {
      if (this.eatKw("between")) {
        const frameStart = this.parseWindowFrameBound();
        this.expectKw("and");
        frame = { unit, start: frameStart, end: this.parseWindowFrameBound() };
      } else {
        frame = { unit, start: this.parseWindowFrameBound() };
      }
    }
    this.expectOp(")");
    this.count();
    return {
      _tag: "WindowExpr",
      fn,
      partitionBy,
      orderBy,
      frame,
      span: this.span(start),
    };
  }

  private tryParseWindowUnit(): WindowFrame["unit"] | typeof Schema.Undefined.Type {
    if (this.eatKw("rows")) return "rows";
    if (this.eatKw("range")) return "range";
    return undefined;
  }

  private parseWindowFrameBound(): WindowFrameBound {
    if (this.eatKw("current")) {
      this.expectKw("row");
      return "currentRow";
    }
    if (this.eatKw("unbounded")) {
      if (this.eatKw("preceding")) return "unboundedPreceding";
      if (this.eatKw("following")) return "unboundedFollowing";
    }
    throw new VoidQlUnsupportedError({
      message: `line ${this.peek().start.line}, col ${this.peek().start.col}: Unsupported window frame bound.`,
      hint: "Use UNBOUNDED PRECEDING, CURRENT ROW, or UNBOUNDED FOLLOWING.",
    });
  }

  private parseColumnRef(): Expr {
    const start = this.peek().start;
    const chain: [string, ...string[]] = [this.next().text];
    const parseChainTail = (): Expr | typeof Schema.Undefined.Type => {
      if (!this.isOp(".")) return undefined;
      this.next();
      if (this.eatOp("*")) {
        this.count();
        return { _tag: "StarRef", qualifier: chain.join("."), span: this.span(start) };
      }
      const seg = this.peek();
      if (seg.kind !== "ident") this.fail(seg, "Expected a column or property name after '.'.");
      this.index += 1;
      chain.push(seg.text);
      return parseChainTail();
    };
    const star = parseChainTail();
    if (star !== undefined) return star;
    this.count();
    return { _tag: "ColumnRef", chain, span: this.span(start) };
  }

  private parseCaseWhenBranch(): CaseWhen {
    const when = this.parseExpr(0);
    this.expectKw("then");
    const then = this.parseExpr(0);
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is the SQL CASE ... WHEN ... THEN branch of the frozen `CaseWhen` AST node; renaming the field would change the AST contract every consumer and the compiler match on.
    return { when, then };
  }

  private parseCase(): Expr {
    const start = this.peek().start;
    this.expectKw("case");
    let operand: Expr | typeof Schema.Undefined.Type;
    if (!this.isKw("when")) operand = this.parseExpr(0);
    if (!this.eatKw("when")) this.fail(this.peek(), "CASE requires at least one WHEN branch.");
    const whens: [CaseWhen, ...CaseWhen[]] = [this.parseCaseWhenBranch()];
    const parseWhenTail = (): void => {
      if (!this.eatKw("when")) return;
      whens.push(this.parseCaseWhenBranch());
      parseWhenTail();
    };
    parseWhenTail();
    const elseExpr = this.after("else", () => this.parseExpr(0));
    this.expectKw("end");
    this.count();
    return {
      _tag: "CaseExpr",
      operand,
      whens,
      else: elseExpr,
      span: this.span(start),
    };
  }
}

/**
 * Parse VoidQL query text into a {@link Statement}. Throws
 * {@link VoidQlSyntaxError}, {@link VoidQlUnsupportedError}, or
 * {@link VoidQlComplexityError} as typed values (never a string).
 */
export const parse = (text: string): Statement => new Cursor(lex(text)).parseStatement();
