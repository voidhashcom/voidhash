import { Schema } from 'effect';

export class UnauthenticatedError extends Schema.TaggedError<UnauthenticatedError>()(
  'UnauthenticatedError',
  {
    message: Schema.String
  }
) {}

export class ActionForbiddenError extends Schema.TaggedError<ActionForbiddenError>()(
  'ActionForbiddenError',
  {
    message: Schema.String
  }
) {}

// API Key Service Errors
export class ApiKeyNotFoundError extends Schema.TaggedError<ApiKeyNotFoundError>()(
  'ApiKeyNotFoundError',
  {
    message: Schema.String
  }
) {}

// App Store Server API Service Errors

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

// Auth Service Errors
export class InvalidSourceError extends Schema.TaggedError<InvalidSourceError>()(
  'InvalidSourceError',
  {
    message: Schema.String
  }
) {}

export class InvalidSecretKeyError extends Schema.TaggedError<InvalidSecretKeyError>()(
  'InvalidSecretKeyError',
  {
    message: Schema.String
  }
) {}

export class InvalidPublishableKeyError extends Schema.TaggedError<InvalidPublishableKeyError>()(
  'InvalidPublishableKeyError',
  {
    message: Schema.String
  }
) {}

export class MissingProjectIdError extends Schema.TaggedError<MissingProjectIdError>()(
  'MissingProjectIdError',
  {
    message: Schema.String
  }
) {}

export class MissingAppUserIdError extends Schema.TaggedError<MissingAppUserIdError>()(
  'MissingAppUserIdError',
  {
    message: Schema.String
  }
) {}

export class InvalidAuthMethodError extends Schema.TaggedError<InvalidAuthMethodError>()(
  'InvalidAuthMethodError',
  {
    message: Schema.String
  }
) {}

// Customer Service Errors
export class CustomerNotFoundError extends Schema.TaggedError<CustomerNotFoundError>()(
  'CustomerNotFoundError',
  {
    message: Schema.String
  }
) {}

export class InvalidAnonymousIdError extends Schema.TaggedError<InvalidAnonymousIdError>()(
  'InvalidAnonymousIdError',
  {
    message: Schema.String
  }
) {}

// Environment Service Errors
export class MissingEnvironmentError extends Schema.TaggedError<MissingEnvironmentError>()(
  'MissingEnvironmentError',
  {
    message: Schema.String
  }
) {}

export class InvalidEnvironmentError extends Schema.TaggedError<InvalidEnvironmentError>()(
  'InvalidEnvironmentError',
  {
    message: Schema.String
  }
) {}

export class EnvironmentCookieNotFoundError extends Schema.TaggedError<EnvironmentCookieNotFoundError>()(
  'EnvironmentCookieNotFoundError',
  {
    message: Schema.String
  }
) {}

export class ProjectNotFoundInSessionError extends Schema.TaggedError<ProjectNotFoundInSessionError>()(
  'ProjectNotFoundInSessionError',
  {
    message: Schema.String
  }
) {}

export class OrganizationNotFoundInSessionError extends Schema.TaggedError<OrganizationNotFoundInSessionError>()(
  'OrganizationNotFoundInSessionError',
  {
    message: Schema.String
  }
) {}

export class ProjectNotFoundError extends Schema.TaggedError<ProjectNotFoundError>()(
  'ProjectNotFoundError',
  {
    message: Schema.String
  }
) {}

export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>()(
  'OrganizationNotFoundError',
  {
    message: Schema.String
  }
) {}

export class OrganizationWithoutSlugError extends Schema.TaggedError<OrganizationWithoutSlugError>()(
  'OrganizationWithoutSlugError',
  {
    message: Schema.String
  }
) {}

// Organization Service Errors
export class FailedToCreateOrganizationError extends Schema.TaggedError<FailedToCreateOrganizationError>()(
  'FailedToCreateOrganizationError',
  {
    message: Schema.String
  }
) {}

export class UserSessionNotFoundError extends Schema.TaggedError<UserSessionNotFoundError>()(
  'UserSessionNotFoundError',
  {
    message: Schema.String
  }
) {}

export class OrganizationNotFound extends Schema.TaggedError<OrganizationNotFound>()(
  'OrganizationNotFound',
  {
    message: Schema.String
  }
) {}

// Payment Provider Core Service Errors
export class SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError extends Schema.TaggedError<SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError>()(
  'SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError',
  {
    message: Schema.String
  }
) {}

export class SubscriptionWithSameInitialTransactionIdAlreadyExistsError extends Schema.TaggedError<SubscriptionWithSameInitialTransactionIdAlreadyExistsError>()(
  'SubscriptionWithSameInitialTransactionIdAlreadyExistsError',
  {
    message: Schema.String
  }
) {}

export class PaymentProviderConfigurationProductNotFoundError extends Schema.TaggedError<PaymentProviderConfigurationProductNotFoundError>()(
  'PaymentProviderConfigurationProductNotFoundError',
  {
    message: Schema.String
  }
) {}

export class SubscriptionNotFoundError extends Schema.TaggedError<SubscriptionNotFoundError>()(
  'SubscriptionNotFoundError',
  {
    message: Schema.String
  }
) {}

// Payment Provider Service Errors
export class PaymentProviderNotFoundError extends Schema.TaggedError<PaymentProviderNotFoundError>()(
  'PaymentProviderNotFoundError',
  {
    message: Schema.String
  }
) {}

export class PaymentProviderAlreadyExistsError extends Schema.TaggedError<PaymentProviderAlreadyExistsError>()(
  'PaymentProviderAlreadyExistsError',
  {
    message: Schema.String
  }
) {}

export class PaymentProviderConfigurationNotFound extends Schema.TaggedError<PaymentProviderConfigurationNotFound>()(
  'PaymentProviderConfigurationNotFound',
  {
    message: Schema.String
  }
) {}

export class PaymentProviderKeyUnavailableError extends Schema.TaggedError<PaymentProviderKeyUnavailableError>()(
  'PaymentProviderKeyUnavailableError',
  {
    message: Schema.String
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  'ValidationError',
  {
    message: Schema.String
  }
) {}

// Paywall Location Service Errors
export class SlugAlreadyExistsError extends Schema.TaggedError<SlugAlreadyExistsError>()(
  'SlugAlreadyExistsError',
  {
    message: Schema.String
  }
) {}

export class DefaultPaywallNotFoundError extends Schema.TaggedError<DefaultPaywallNotFoundError>()(
  'DefaultPaywallNotFoundError',
  {
    message: Schema.String
  }
) {}

export class PaywallLocationNotFound extends Schema.TaggedError<PaywallLocationNotFound>()(
  'PaywallLocationNotFound',
  {
    message: Schema.String
  }
) {}

// Paywall Service Errors
export class PaywallNotFoundError extends Schema.TaggedError<PaywallNotFoundError>()(
  'PaywallNotFoundError',
  {
    message: Schema.String
  }
) {}

export class PaywallInUseError extends Schema.TaggedError<PaywallInUseError>()(
  'PaywallInUseError',
  {
    message: Schema.String
  }
) {}

// Perk Service Errors
export class PerkNotFound extends Schema.TaggedError<PerkNotFound>()(
  'PerkNotFound',
  {
    message: Schema.String
  }
) {}

// Product Service Errors
export class ProductNotFound extends Schema.TaggedError<ProductNotFound>()(
  'ProductNotFound',
  {
    message: Schema.String
  }
) {}

export class ProviderProductNotFound extends Schema.TaggedError<ProviderProductNotFound>()(
  'ProviderProductNotFound',
  {
    message: Schema.String
  }
) {}

// Project Service Errors
export class ProjectNotFound extends Schema.TaggedError<ProjectNotFound>()(
  'ProjectNotFound',
  {
    message: Schema.String
  }
) {}

export class PaywallNotFound extends Schema.TaggedError<PaywallNotFound>()(
  'PaywallNotFound',
  {
    message: Schema.String
  }
) {}

export class CustomerConflictError extends Schema.TaggedError<CustomerConflictError>()(
  'CustomerConflict',
  {
    message: Schema.String
  }
) {}
