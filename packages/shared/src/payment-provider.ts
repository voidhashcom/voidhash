import { Schema } from 'effect';

export class PaymentProviderServiceError extends Schema.TaggedError<PaymentProviderServiceError>()(
  'PaymentProviderServiceError',
  {
    cause: Schema.String
  }
) {}

export class PaymentProviderNotFoundError extends Schema.TaggedError<PaymentProviderNotFoundError>()(
  'PaymentProviderNotFoundError',
  {
    message: Schema.String
  }
) {}

export class PaymentProviderConfigurationNotFoundError extends Schema.TaggedError<PaymentProviderConfigurationNotFoundError>()(
  'PaymentProviderConfigurationNotFoundError',
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

export class PaymentProviderAlreadyExistsError extends Schema.TaggedError<PaymentProviderAlreadyExistsError>()(
  'PaymentProviderAlreadyExistsError',
  {
    message: Schema.String
  }
) {}
