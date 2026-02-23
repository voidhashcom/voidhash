import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic SDK service error */
export class SdkServiceError extends Schema.TaggedError<SdkServiceError>()(
  "SdkServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** SDK customer not found */
export class SdkCustomerNotFoundError extends Schema.TaggedError<SdkCustomerNotFoundError>()(
  "SdkCustomerNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** SDK customer already identified */
export class SdkCustomerAlreadyIdentifiedError extends Schema.TaggedError<SdkCustomerAlreadyIdentifiedError>()(
  "SdkCustomerAlreadyIdentifiedError",
  {
    appUserId: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  toString(): string {
    return `The following customer was already identified: ${this.appUserId}`;
  }
}

/** SDK validation error */
export class SdkValidationError extends Schema.TaggedError<SdkValidationError>()(
  "SdkValidationError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}
