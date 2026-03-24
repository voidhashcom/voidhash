import { Schema } from "effect";

/** Generic SDK service error */
export class SdkServiceError extends Schema.TaggedErrorClass<SdkServiceError>()(
  "SdkServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** SDK customer not found */
export class SdkCustomerNotFoundError extends Schema.TaggedErrorClass<SdkCustomerNotFoundError>()(
  "SdkCustomerNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** SDK customer already identified */
export class SdkCustomerAlreadyIdentifiedError extends Schema.TaggedErrorClass<SdkCustomerAlreadyIdentifiedError>()(
  "SdkCustomerAlreadyIdentifiedError",
  {
    distinctId: Schema.String,
  },
  { httpApiStatus: 409 }
) {
  override toString(): string {
    return `The following customer was already identified: ${this.distinctId}`;
  }
}

/** SDK validation error */
export class SdkValidationError extends Schema.TaggedErrorClass<SdkValidationError>()(
  "SdkValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}
