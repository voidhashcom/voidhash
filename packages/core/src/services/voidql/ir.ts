/**
 * The compiled-query intermediate representation: a flat list of {@link SqlPiece}s.
 *
 * Each piece is either a chunk of compiler-controlled structural SQL (`sql`) or a
 * bound parameter (`param`). This *is* the "ResolvedQuery IR" the value-level
 * verifier walks (§10, §18 gap #2): it inspects `(sql, binds)` jointly, which a
 * placeholder-syntax count cannot. Keeping the printer pure over pieces makes it
 * trivially unit-testable and fuzzable; {@link toStatement} is the thin adapter
 * that replays the pieces through the audited `ch.literal`/`ch.param` substrate
 * for execution, and {@link renderDebugSql} reproduces the exact compiled text +
 * binds for the verifier and golden tests.
 */
import type { ClickhouseWebClient } from "@voidhash/clickhouse-db/clickhouse-client-web";
import type { Statement } from "effect/unstable/sql/Statement";

import { type CatalogSql, catalog } from "./catalog/brand.ts";

/** A value bound out-of-band as a ClickHouse named parameter. */
export type ParamValue = string | number | boolean | readonly string[] | readonly number[];

export type SqlPiece =
  | { readonly kind: "sql"; readonly text: CatalogSql }
  | { readonly kind: "param"; readonly chType: string; readonly value: ParamValue };

/**
 * Emit structural SQL. The single funnel for `CatalogSql` minting in the printer
 * and catalog — only ever fed keywords, validated identifiers, and frozen catalog
 * constants, NEVER user text (the §12 invariant; lint-guarded).
 */
export const lit = (text: string): SqlPiece => ({ kind: "sql", text: catalog(text) });

/** Emit a bound parameter with an explicit ClickHouse type (§18 gap #9). */
export const par = (chType: string, value: ParamValue): SqlPiece => ({
  kind: "param",
  chType,
  value,
});

/**
 * Render the pieces to the exact compiled SQL text (with `{pN: Type}` placeholders)
 * and the ordered bind list — matching what {@link toStatement} + the ClickHouse
 * compiler produce. Pure; no `ch` needed.
 */
export const renderDebugSql = (
  pieces: readonly SqlPiece[],
): { readonly sql: string; readonly binds: readonly ParamValue[] } => {
  let sql = "";
  const binds: ParamValue[] = [];
  for (const piece of pieces) {
    if (piece.kind === "sql") {
      sql += piece.text;
    } else {
      binds.push(piece.value);
      sql += `{p${binds.length}: ${piece.chType}}`;
    }
  }
  return { sql, binds };
};

/**
 * Replay the IR through the audited `ch` substrate, yielding an executable
 * {@link Statement}. Structural pieces become `ch.literal(CatalogSql)`; parameters
 * become `ch.param(type, value)` — bound out-of-band in `query_params`, never
 * spliced.
 */
export const toStatement = <Row extends object = Record<string, unknown>>(
  ch: ClickhouseWebClient.ClickhouseWebClient,
  pieces: readonly SqlPiece[],
): Statement<Row> =>
  pieces.reduce<Statement<Row>>(
    (frag, piece) =>
      piece.kind === "sql"
        ? ch<Row>`${frag}${ch.literal(piece.text)}`
        : ch<Row>`${frag}${ch.param(piece.chType, piece.value)}`,
    ch<Row>``,
  );
