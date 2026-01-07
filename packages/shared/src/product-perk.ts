import { Schema } from "effect";

export class ProductPerkServiceError extends Schema.TaggedError<ProductPerkServiceError>()(
  "ProductPerkServiceError",
  {
    cause: Schema.String,
  }
) {}

export class ProductPerkValidationError extends Schema.TaggedError<ProductPerkValidationError>()(
  "ProductPerkValidationError",
  {
    message: Schema.String,
  }
) {}
