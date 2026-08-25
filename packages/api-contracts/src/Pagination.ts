import { Schema } from "effect";

/**
 * Largest page a caller may request. Kept low enough that a single page always
 * fits comfortably inside a Workers response, and high enough that scripted
 * consumers rarely need more than a handful of round trips.
 */
export const MAX_PAGE_SIZE = 100;

/** Page size used when the caller does not ask for one. */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Query parameters every collection endpoint accepts. `cursor` is opaque: it
 * encodes the sort key of the last item on the previous page and must be
 * echoed back verbatim rather than constructed by the caller.
 */
export const PageParams = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(
    Schema.FiniteFromString.check(Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })),
  ),
});

/**
 * Cursor state for the next page. `endCursor` is `null` exactly when
 * `hasNextPage` is false, so callers can loop on either without special-casing.
 */
export const PageInfo = Schema.Struct({
  endCursor: Schema.NullOr(Schema.String),
  hasNextPage: Schema.Boolean,
}).annotate({ identifier: "PageInfo" });

export type PageInfo = typeof PageInfo.Type;

/**
 * Wraps an item schema in the standard collection envelope. Every list endpoint
 * returns this shape so a consumer can write one pagination helper and reuse it
 * across the whole API.
 *
 * @example
 * ```ts
 * HttpApiEndpoint.get("listProducts", "/", {
 *   query: PageParams,
 *   success: paginated(Product),
 * })
 * ```
 */
export const paginated = <S extends Schema.Top>(item: S) =>
  Schema.Struct({
    data: Schema.Array(item),
    pageInfo: PageInfo,
  });
