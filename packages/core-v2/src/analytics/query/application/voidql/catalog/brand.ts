/**
 * The type-level barrier that makes "no user string ever reaches `ch.literal`"
 * a compiler-checked invariant. {@link CatalogSqlSchema} produces a branded string;
 * the printer's `lit()` accepts only the brand, and {@link catalog} — the sole
 * constructor — is fed exclusively from frozen catalog/keyword constants and
 * already-validated identifiers, never from user text.
 */
import { Brand, Schema } from "effect";

export const CatalogSqlSchema = Schema.String.pipe(Schema.brand("CatalogSql"));

/** Brand a compiler-controlled SQL fragment. NEVER call with user-derived text. */
export const catalog = Brand.nominal<typeof CatalogSqlSchema.Type>();
