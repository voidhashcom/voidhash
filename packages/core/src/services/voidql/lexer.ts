/**
 * The VoidQL lexer — hand-written, `workerd`-pure (no `eval`, no Node deps).
 *
 * String lexing is **ClickHouse-faithful**: single-quoted, with `''` doubling
 * (NOT backslash) escaping a quote. CVE-2025-1520 was a lexer escape mismatch, so
 * a borrowed/Postgres lexer is an *isolation* risk, not a correctness bug (§8.1).
 * Comments (`-- …`, `/* … *​/`) are dropped here, so the canonical re-print can
 * never carry smuggled bytes (T9).
 *
 * Reserved words — including the deferred/denied ones (`SETTINGS`, `UNION`, …) —
 * tokenise as keywords so the parser can raise a teachable error rather than
 * mis-parsing them as identifiers, and so they can never be used as aliases.
 */
import type { Pos } from "./ast/VoidQlAst.ts";
import { VoidQlComplexityError, VoidQlSyntaxError } from "./errors.ts";

export type TokenKind = "ident" | "kw" | "string" | "number" | "op" | "eof";

export interface Token {
  readonly kind: TokenKind;
  /** Keyword tokens are lower-cased; identifiers keep their source case. */
  readonly text: string;
  readonly start: Pos;
  readonly end: Pos;
  /** For `string` tokens: the decoded value. For `number`: the numeric value. */
  readonly value?: string | number;
  /** For `number` tokens: the resolved scalar type. */
  readonly numType?: "Int64" | "UInt64" | "Float64";
}

/** Structural keywords that have a grammar production in v1. */
const ALLOWED_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "group",
  "by",
  "having",
  "order",
  "asc",
  "desc",
  "limit",
  "offset",
  "join",
  "inner",
  "left",
  "on",
  "as",
  "with",
  "and",
  "or",
  "not",
  "in",
  "between",
  "is",
  "null",
  "true",
  "false",
  "case",
  "when",
  "then",
  "else",
  "end",
  "like",
]);

/**
 * Reserved words with **no v1 production** — deferred constructs and permanently
 * denied statements. Tokenised so the parser fails closed with a teachable error
 * (a parse error, not a parse-then-reject — §8.1, §11, §18 gap #8).
 */
const FORBIDDEN_KEYWORDS = new Set([
  "settings",
  "set",
  "format",
  "into",
  "insert",
  "update",
  "delete",
  "alter",
  "create",
  "drop",
  "grant",
  "revoke",
  "system",
  "final",
  "sample",
  "union",
  "distinct",
  "all",
  "over",
  "right",
  "full",
  "outer",
  "cross",
  "using",
  "prewhere",
  "array",
  "arrayjoin",
  "interval",
  "values",
  "table",
  "database",
  "attach",
  "detach",
  "optimize",
  "kill",
  "show",
  "describe",
  "explain",
  "use",
  "outfile",
  "infile",
]);

const KEYWORDS = new Set([...ALLOWED_KEYWORDS, ...FORBIDDEN_KEYWORDS]);

/** Exposed so the parser can classify a `kw` token without re-deriving the set. */
export const isForbiddenKeyword = (lower: string): boolean => FORBIDDEN_KEYWORDS.has(lower);

const MAX_TOKENS = 50_000;

const isIdentStart = (c: string): boolean => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string): boolean => /[A-Za-z0-9_]/.test(c);
const isDigit = (c: string): boolean => c >= "0" && c <= "9";

/**
 * Tokenise `text` into a flat token stream terminated by an `eof` token. Throws
 * {@link VoidQlSyntaxError} on malformed input and {@link VoidQlComplexityError}
 * when the token cap is exceeded (a DoS bound applied *before* parsing).
 */
export const lex = (text: string): readonly Token[] => {
  const tokens: Token[] = [];
  let offset = 0;
  let line = 1;
  let col = 1;

  const pos = (): Pos => ({ line, col, offset });

  const advance = (): string => {
    const c = text[offset]!;
    offset += 1;
    if (c === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    return c;
  };

  const peek = (ahead = 0): string => text[offset + ahead] ?? "";

  const push = (token: Token): void => {
    if (tokens.length >= MAX_TOKENS) {
      throw new VoidQlComplexityError({ message: "Query is too large." });
    }
    tokens.push(token);
  };

  const fail = (start: Pos, message: string): never => {
    throw new VoidQlSyntaxError({
      message: `line ${start.line}, col ${start.col}: ${message}`,
      hint: "",
    });
  };

  while (offset < text.length) {
    const c = peek();

    // whitespace
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      advance();
      continue;
    }

    // line comment
    if (c === "-" && peek(1) === "-") {
      while (offset < text.length && peek() !== "\n") advance();
      continue;
    }

    // block comment
    if (c === "/" && peek(1) === "*") {
      const start = pos();
      advance();
      advance();
      let closed = false;
      while (offset < text.length) {
        if (peek() === "*" && peek(1) === "/") {
          advance();
          advance();
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) fail(start, "Unterminated block comment.");
      continue;
    }

    // string literal — single-quoted, '' escapes a quote, no backslash escaping
    if (c === "'") {
      const start = pos();
      advance();
      let value = "";
      let closed = false;
      while (offset < text.length) {
        const ch = advance();
        if (ch === "'") {
          if (peek() === "'") {
            advance();
            value += "'";
            continue;
          }
          closed = true;
          break;
        }
        value += ch;
      }
      if (!closed) fail(start, "Unterminated string literal.");
      push({ kind: "string", text: value, value, start, end: pos() });
      continue;
    }

    // number literal
    if (isDigit(c) || (c === "." && isDigit(peek(1)))) {
      const start = pos();
      let raw = "";
      let isFloat = false;
      while (offset < text.length && isDigit(peek())) raw += advance();
      if (peek() === ".") {
        isFloat = true;
        raw += advance();
        while (offset < text.length && isDigit(peek())) raw += advance();
      }
      if (peek() === "e" || peek() === "E") {
        isFloat = true;
        raw += advance();
        if (peek() === "+" || peek() === "-") raw += advance();
        if (!isDigit(peek())) fail(start, "Malformed exponent in number literal.");
        while (offset < text.length && isDigit(peek())) raw += advance();
      }
      // A trailing identifier char immediately after a number is illegal (e.g. `1abc`).
      if (isIdentStart(peek())) fail(start, "Invalid number literal.");
      const num = Number(raw);
      if (!Number.isFinite(num)) fail(start, "Number literal out of range.");
      push({
        kind: "number",
        text: raw,
        value: num,
        numType: isFloat ? "Float64" : "Int64",
        start,
        end: pos(),
      });
      continue;
    }

    // identifier or keyword
    if (isIdentStart(c)) {
      const start = pos();
      let raw = "";
      while (offset < text.length && isIdentPart(peek())) raw += advance();
      const lower = raw.toLowerCase();
      if (KEYWORDS.has(lower)) {
        push({ kind: "kw", text: lower, start, end: pos() });
      } else {
        push({ kind: "ident", text: raw, start, end: pos() });
      }
      continue;
    }

    // operators / punctuation
    const start = pos();
    const two = c + peek(1);
    if (two === "<=" || two === ">=" || two === "!=" || two === "<>") {
      advance();
      advance();
      push({ kind: "op", text: two === "<>" ? "!=" : two, start, end: pos() });
      continue;
    }
    if ("=<>+-*/%(),.".includes(c)) {
      advance();
      push({ kind: "op", text: c, start, end: pos() });
      continue;
    }

    fail(start, `Unexpected character '${c}'.`);
  }

  push({ kind: "eof", text: "", start: pos(), end: pos() });
  return tokens;
};
