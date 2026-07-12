import { Schema } from "effect";

/** Generic product service error */
export class ApiProductServiceError extends Schema.TaggedErrorClass<ApiProductServiceError>()(
  "Api/ProductServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Product not found */
export class ApiProductNotFoundError extends Schema.TaggedErrorClass<ApiProductNotFoundError>()(
  "Api/ProductNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Product slug already exists */
export class ApiProductSlugAlreadyExistsError extends Schema.TaggedErrorClass<ApiProductSlugAlreadyExistsError>()(
  "Api/ProductSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  { httpApiStatus: 409 },
) {
  override toString(): string {
    return `The following product slug already exists: ${this.slug}`;
  }
}
