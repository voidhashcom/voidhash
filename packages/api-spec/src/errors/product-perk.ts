import { Schema } from "effect";

/** Generic product perk service error */
export class ProductPerkServiceError extends Schema.TaggedErrorClass<ProductPerkServiceError>()(
  "ProductPerkServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Product perk validation error */
export class ProductPerkValidationError extends Schema.TaggedErrorClass<ProductPerkValidationError>()(
  "ProductPerkValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}
