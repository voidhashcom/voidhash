/**
 * The type-level barrier that makes "no user string ever reaches `ch.literal`"
 * a compiler-checked invariant. {@link CatalogSqlSchema} produces a branded string;
 * the printer's `lit()` accepts only the brand, and {@link catalog} — the sole
 * constructor — is fed exclusively from frozen catalog/keyword constants and
 * already-validated identifiers, never from user text.
 */
import * as Brand from "effect/Brand";
import * as Schema from "effect/Schema";

export const CatalogSql = Schema.String.pipe(Schema.brand("CatalogSql"));
export type CatalogSql = typeof CatalogSql.Type;

/** Brand a compiler-controlled SQL fragment. NEVER call with user-derived text. */
export const catalog = Brand.nominal<typeof CatalogSql.Type>();

export { CatalogSql as CatalogSqlSchema };
