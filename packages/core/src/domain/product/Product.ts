/**
 * Product domain — typed errors that signal a product invariant violation.
 * Row data lives in the `products` Drizzle table; the `ProductType` enum
 * lives with the schema in `@voidhash/db/schema`.
 */
import * as Schema from "effect/Schema";

/** Product row not found in the database. */
export class ProductNotFoundError extends Schema.TaggedErrorClass<ProductNotFoundError>(
  "ProductNotFoundError",
)("ProductNotFoundError", { message: Schema.String }) {}

/** Product slug uniqueness invariant violated within a project. */
export class ProductSlugAlreadyExistsError extends Schema.TaggedErrorClass<ProductSlugAlreadyExistsError>(
  "ProductSlugAlreadyExistsError",
)("ProductSlugAlreadyExistsError", { slug: Schema.String }) {}

/** Product type and subscription-duration combination is invalid. */
export class ProductValidationError extends Schema.TaggedErrorClass<ProductValidationError>(
  "ProductValidationError",
)("ProductValidationError", { message: Schema.String }) {}
