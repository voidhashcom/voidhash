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

/** Product perk link not found */
export class ApiProductPerkNotFoundError extends Schema.TaggedErrorClass<ApiProductPerkNotFoundError>()(
  "Api/ProductPerkNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** The perk is already attached to the product */
export class ApiProductPerkAlreadyExistsError extends Schema.TaggedErrorClass<ApiProductPerkAlreadyExistsError>()(
  "Api/ProductPerkAlreadyExistsError",
  {
    perkId: Schema.String,
    productId: Schema.String,
  },
  { httpApiStatus: 409 },
) {
  override toString(): string {
    return `Perk ${this.perkId} is already attached to product ${this.productId}`;
  }
}
