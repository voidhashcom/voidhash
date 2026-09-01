import * as Arr from "effect/Array";
import * as R from "effect/Record";
import { CatalogSqlSchema, catalog } from "./catalog/brand.ts";

export type ParamValue = string | number | boolean | readonly string[];

export type SqlPiece =
  | { readonly kind: "sql"; readonly text: typeof CatalogSqlSchema.Type }
  | { readonly kind: "param"; readonly chType: string; readonly value: ParamValue };

/** Emit a compiler-controlled SQL fragment. */
export const lit = (text: string): SqlPiece => ({ kind: "sql", text: catalog(text) });

/** Emit a value that must be bound out of band. */
export const par = (chType: string, value: ParamValue): SqlPiece => ({
  kind: "param",
  chType,
  value,
});

const emptyRenderedSql: { readonly sql: string; readonly binds: readonly ParamValue[] } = {
  sql: "",
  binds: [],
};

/** Render verified IR to ClickHouse SQL and its ordered bind list. */
export const renderDebugSql = (
  pieces: readonly SqlPiece[],
): { readonly sql: string; readonly binds: readonly ParamValue[] } =>
  Arr.reduce(pieces, emptyRenderedSql, (rendered, piece) => {
    if (piece.kind === "sql") {
      return { ...rendered, sql: rendered.sql + piece.text };
    }
    const binds = [...rendered.binds, piece.value];
    return { sql: `${rendered.sql}{p${binds.length}: ${piece.chType}}`, binds };
  });

export interface VoidQlStatement {
  readonly sql: string;
  readonly params: Readonly<Record<string, ParamValue>>;
}

/** Convert verified IR to the generic statement consumed by query adapters. */
export const toStatement = (pieces: readonly SqlPiece[]): VoidQlStatement => {
  const rendered = renderDebugSql(pieces);
  return {
    sql: rendered.sql,
    params: R.fromEntries(rendered.binds.map((value, index) => [`p${index + 1}`, value])),
  };
};
