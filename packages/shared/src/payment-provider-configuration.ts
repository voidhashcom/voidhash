import { Schema } from 'effect';

export class PaymentProviderConfigurationServiceError extends Schema.TaggedError<PaymentProviderConfigurationServiceError>()(
  'PaymentProviderConfigurationServiceError',
  {
    cause: Schema.String
  }
) {}

export class PaymentProviderConfigurationNotFoundError extends Schema.TaggedError<PaymentProviderConfigurationNotFoundError>()(
  'PaymentProviderConfigurationNotFoundError',
  {
    message: Schema.String
  }
) {}

export class PaymentProviderConfigurationValidationError extends Schema.TaggedError<PaymentProviderConfigurationValidationError>()(
  'PaymentProviderConfigurationValidationError',
  {
    cause: Schema.String
  }
) {}

export class PaymentProviderConfigurationKeyUnavailableError extends Schema.TaggedError<PaymentProviderConfigurationKeyUnavailableError>()(
  'PaymentProviderConfigurationKeyUnavailableError',
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
