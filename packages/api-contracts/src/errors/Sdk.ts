import * as Schema from "effect/Schema";

/** Generic SDK service error */
export class ApiSdkServiceError extends Schema.TaggedErrorClass<ApiSdkServiceError>()(
  "Api/SdkServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** SDK person not found */
export class ApiSdkPersonNotFoundError extends Schema.TaggedErrorClass<ApiSdkPersonNotFoundError>()(
  "Api/SdkPersonNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** SDK person already identified */
export class ApiSdkPersonAlreadyIdentifiedError extends Schema.TaggedErrorClass<ApiSdkPersonAlreadyIdentifiedError>()(
  "Api/SdkPersonAlreadyIdentifiedError",
  {
    distinctId: Schema.String,
  },
  { httpApiStatus: 409 },
) {
  override toString(): string {
    return `The following person was already identified: ${this.distinctId}`;
  }
}

/** SDK validation error */
export class ApiSdkValidationError extends Schema.TaggedErrorClass<ApiSdkValidationError>()(
  "Api/SdkValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}
