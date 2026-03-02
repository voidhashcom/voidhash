import { Schema } from "effect";

/** Generic product service error */
export class ProductServiceError extends Schema.TaggedErrorClass<ProductServiceError>()(
  "ProductServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Product not found */
export class ProductNotFoundError extends Schema.TaggedErrorClass<ProductNotFoundError>()(
  "ProductNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** Product slug already exists */
export class ProductSlugAlreadyExistsError extends Schema.TaggedErrorClass<ProductSlugAlreadyExistsError>()(
  "ProductSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  { httpApiStatus: 409 }
) {
  toString(): string {
    return `The following product slug already exists: ${this.slug}`;
  }
}
