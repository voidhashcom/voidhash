/**
 * The type-level barrier that makes "no user string ever reaches `ch.literal`"
 * a compiler-checked invariant (§12). {@link CatalogSql} is a branded string;
 * the printer's `lit()` accepts only the brand, and {@link catalog} — the sole
 * constructor — is fed exclusively from frozen catalog/keyword constants and
 * already-validated identifiers, never from user text. A lint/CODEOWNERS rule
 * keeps `ch.literal(` and `catalog(` confined to the VoidQL printer + catalog.
 */
import { Schema } from "effect";

export const CatalogSqlSchema = Schema.String.pipe(Schema.brand("CatalogSql"));

export type CatalogSql = typeof CatalogSqlSchema.Type;

/** Brand a compiler-controlled SQL fragment. NEVER call with user-derived text. */
export const catalog = (s: string): CatalogSql => s as CatalogSql;
