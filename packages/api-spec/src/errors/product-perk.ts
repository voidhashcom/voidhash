import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic product perk service error */
export class ProductPerkServiceError extends Schema.TaggedError<ProductPerkServiceError>()(
  "ProductPerkServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Product perk validation error */
export class ProductPerkValidationError extends Schema.TaggedError<ProductPerkValidationError>()(
  "ProductPerkValidationError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}
