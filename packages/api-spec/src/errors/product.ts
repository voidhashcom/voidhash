import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic product service error */
export class ProductServiceError extends Schema.TaggedError<ProductServiceError>()(
  "ProductServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Product not found */
export class ProductNotFoundError extends Schema.TaggedError<ProductNotFoundError>()(
  "ProductNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** Product slug already exists */
export class ProductSlugAlreadyExistsError extends Schema.TaggedError<ProductSlugAlreadyExistsError>()(
  "ProductSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  toString(): string {
    return `The following product slug already exists: ${this.slug}`;
  }
}
