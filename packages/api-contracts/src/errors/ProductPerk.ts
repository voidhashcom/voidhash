import { Schema } from "effect";

/** Generic product perk service error */
export class ApiProductPerkServiceError extends Schema.TaggedErrorClass<ApiProductPerkServiceError>()(
  "Api/ProductPerkServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Product perk validation error */
export class ApiProductPerkValidationError extends Schema.TaggedErrorClass<ApiProductPerkValidationError>()(
  "Api/ProductPerkValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}
