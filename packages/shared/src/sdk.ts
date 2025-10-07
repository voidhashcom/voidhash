import { Schema } from 'effect';

export class SdkServiceError extends Schema.TaggedError<SdkServiceError>()(
  'SdkServiceError',
  {
    cause: Schema.String
  }
) {}

export class SdkCustomerNotFoundError extends Schema.TaggedError<SdkCustomerNotFoundError>()(
  'SdkCustomerNotFoundError',
  {
    message: Schema.String
  }
) {}

export class SdkCustomerAlreadyIdentifiedError extends Schema.TaggedError<SdkCustomerAlreadyIdentifiedError>()(
  'SdkCustomerAlreadyIdentifiedError',
  {
    appUserId: Schema.String
  }
) {
  toString(): string {
    return `The following customer was already identified: ${this.appUserId}`;
  }
}

export class SdkValidationError extends Schema.TaggedError<SdkValidationError>()(
  'SdkValidationError',
  {
    message: Schema.String
  }
) {}
