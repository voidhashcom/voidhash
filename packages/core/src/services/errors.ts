import { Data } from 'effect';

export class UnauthenticatedError extends Data.TaggedError(
  'UnauthenticatedError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ActionForbiddenError extends Data.TaggedError(
  'ActionForbiddenError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// API Key Service Errors
export class ApiKeyNotFoundError extends Data.TaggedError(
  'ApiKeyNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// App Store Server API Service Errors
export class AppStoreGeneralError extends Data.TaggedError(
  'AppStoreGeneralError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class AppStoreTransactionNotFoundError extends Data.TaggedError(
  'AppStoreTransactionNotFoundError'
)<{
  readonly transactionId: string;
}> {}

export class AppStoreUnauthorizedError extends Data.TaggedError(
  'AppStoreUnauthorizedError'
)<{
  readonly message: string;
}> {}

export class AppStoreRateLimitExceededError extends Data.TaggedError(
  'AppStoreRateLimitExceededError'
)<{
  readonly message: string;
}> {}

export class AppStoreSignedTransactionInfoNotFoundError extends Data.TaggedError(
  'AppStoreSignedTransactionInfoNotFoundError'
)<{
  readonly message: string;
}> {}

export class AppStoreVerificationException extends Data.TaggedError(
  'AppStoreVerificationException'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// App Store Service Errors
export class AppStoreNotEnabledForThisBundleIdError extends Data.TaggedError(
  'AppStoreNotEnabledForThisBundleIdError'
)<{
  readonly message: string;
}> {}

export class AppStoreServerAPIError extends Data.TaggedError(
  'AppStoreServerAPIError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class AppStoreTransactionDoesNotContainProductIdError extends Data.TaggedError(
  'AppStoreTransactionDoesNotContainProductIdError'
)<{
  readonly message: string;
}> {}

export class AppStoreTransactionValidationFailed extends Data.TaggedError(
  'AppStoreTransactionDoesNotContainCustomerIdError'
)<{
  readonly message: string;
}> {}

// Auth Service Errors
export class InvalidSourceError extends Data.TaggedError('InvalidSourceError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidSecretKeyError extends Data.TaggedError(
  'InvalidSecretKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidPublishableKeyError extends Data.TaggedError(
  'InvalidPublishableKeyError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingProjectIdError extends Data.TaggedError(
  'MissingProjectIdError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class MissingAppUserIdError extends Data.TaggedError(
  'MissingAppUserIdError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidAuthMethodError extends Data.TaggedError(
  'InvalidAuthMethodError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Customer Service Errors
export class CustomerNotFoundError extends Data.TaggedError(
  'CustomerNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidAnonymousIdError extends Data.TaggedError(
  'InvalidAnonymousIdError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Environment Service Errors
export class MissingEnvironmentError extends Data.TaggedError(
  'MissingEnvironmentError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class InvalidEnvironmentError extends Data.TaggedError(
  'InvalidEnvironmentError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class EnvironmentCookieNotFoundError extends Data.TaggedError(
  'EnvironmentCookieNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ProjectNotFoundInSessionError extends Data.TaggedError(
  'ProjectNotFoundInSessionError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class OrganizationNotFoundInSessionError extends Data.TaggedError(
  'OrganizationNotFoundInSessionError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ProjectNotFoundError extends Data.TaggedError(
  'ProjectNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class OrganizationNotFoundError extends Data.TaggedError(
  'OrganizationNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class OrganizationWithoutSlugError extends Data.TaggedError(
  'OrganizationWithoutSlugError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Organization Service Errors
export class FailedToCreateOrganizationError extends Data.TaggedError(
  'FailedToCreateOrganizationError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class UserSessionNotFoundError extends Data.TaggedError(
  'UserSessionNotFoundError'
)<{
  readonly message: string;
}> {}

export class OrganizationNotFound extends Data.TaggedError(
  'OrganizationNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Payment Provider Core Service Errors
export class SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError extends Data.TaggedError(
  'SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class SubscriptionWithSameInitialTransactionIdAlreadyExistsError extends Data.TaggedError(
  'SubscriptionWithSameInitialTransactionIdAlreadyExistsError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderConfigurationProductNotFoundError extends Data.TaggedError(
  'PaymentProviderConfigurationProductNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class SubscriptionNotFoundError extends Data.TaggedError(
  'SubscriptionNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Payment Provider Service Errors
export class PaymentProviderNotFoundError extends Data.TaggedError(
  'PaymentProviderNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderAlreadyExistsError extends Data.TaggedError(
  'PaymentProviderAlreadyExistsError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderConfigurationNotFound extends Data.TaggedError(
  'PaymentProviderConfigurationNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaymentProviderKeyUnavailableError extends Data.TaggedError(
  'PaymentProviderKeyUnavailableError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Paywall Location Service Errors
export class SlugAlreadyExistsError extends Data.TaggedError(
  'SlugAlreadyExistsError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class DefaultPaywallNotFoundError extends Data.TaggedError(
  'DefaultPaywallNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaywallLocationNotFound extends Data.TaggedError(
  'PaywallLocationNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Paywall Service Errors
export class PaywallNotFoundError extends Data.TaggedError(
  'PaywallNotFoundError'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaywallInUseError extends Data.TaggedError('PaywallInUseError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Perk Service Errors
export class PerkNotFound extends Data.TaggedError('PerkNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Product Service Errors
export class ProductNotFound extends Data.TaggedError('ProductNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class ProviderProductNotFound extends Data.TaggedError(
  'ProviderProductNotFound'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Project Service Errors
export class ProjectNotFound extends Data.TaggedError('ProjectNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class PaywallNotFound extends Data.TaggedError('PaywallNotFound')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

export class CustomerConflictError extends Data.TaggedError(
  'CustomerConflict'
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}
