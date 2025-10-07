import { Schema } from 'effect';

export class AppStoreTransactionNotFoundError extends Schema.TaggedError<AppStoreTransactionNotFoundError>()(
  'AppStoreTransactionNotFoundError',
  {
    transactionId: Schema.String
  }
) {}

export class AppStoreUnauthorizedError extends Schema.TaggedError<AppStoreUnauthorizedError>()(
  'AppStoreUnauthorizedError',
  {
    message: Schema.String
  }
) {}

export class AppStoreRateLimitExceededError extends Schema.TaggedError<AppStoreRateLimitExceededError>()(
  'AppStoreRateLimitExceededError',
  {
    message: Schema.String
  }
) {}

export class AppStoreSignedTransactionInfoNotFoundError extends Schema.TaggedError<AppStoreSignedTransactionInfoNotFoundError>()(
  'AppStoreSignedTransactionInfoNotFoundError',
  {
    message: Schema.String
  }
) {}

export class AppStoreVerificationException extends Schema.TaggedError<AppStoreVerificationException>()(
  'AppStoreVerificationException',
  {
    message: Schema.String
  }
) {}

// App Store Service Errors
export class AppStoreNotEnabledForThisBundleIdError extends Schema.TaggedError<AppStoreNotEnabledForThisBundleIdError>()(
  'AppStoreNotEnabledForThisBundleIdError',
  {
    message: Schema.String
  }
) {}

export class AppStoreServerAPIError extends Schema.TaggedError<AppStoreServerAPIError>()(
  'AppStoreServerAPIError',
  {
    message: Schema.String
  }
) {}

export class AppStoreTransactionDoesNotContainProductIdError extends Schema.TaggedError<AppStoreTransactionDoesNotContainProductIdError>()(
  'AppStoreTransactionDoesNotContainProductIdError',
  {
    message: Schema.String
  }
) {}

export class AppStoreTransactionValidationFailed extends Schema.TaggedError<AppStoreTransactionValidationFailed>()(
  'AppStoreTransactionDoesNotContainCustomerIdError',
  {
    message: Schema.String
  }
) {}
