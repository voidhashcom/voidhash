import { Schema } from "effect";

/** Generic payment provider configuration service error */
export class PaymentProviderConfigurationServiceError extends Schema.TaggedErrorClass<PaymentProviderConfigurationServiceError>()(
  "PaymentProviderConfigurationServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Payment provider configuration not found */
export class PaymentProviderConfigurationNotFoundError extends Schema.TaggedErrorClass<PaymentProviderConfigurationNotFoundError>()(
  "PaymentProviderConfigurationNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** Payment provider configuration validation error */
export class PaymentProviderConfigurationValidationError extends Schema.TaggedErrorClass<PaymentProviderConfigurationValidationError>()(
  "PaymentProviderConfigurationValidationError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 400 }
) {}

/** Payment provider configuration key unavailable */
export class PaymentProviderConfigurationKeyUnavailableError extends Schema.TaggedErrorClass<PaymentProviderConfigurationKeyUnavailableError>()(
  "PaymentProviderConfigurationKeyUnavailableError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}

/** Payment provider already exists */
export class PaymentProviderAlreadyExistsError extends Schema.TaggedErrorClass<PaymentProviderAlreadyExistsError>()(
  "PaymentProviderAlreadyExistsError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 409 }
) {}

/** Generic payment provider product service error */
export class PaymentProviderProductServiceError extends Schema.TaggedErrorClass<PaymentProviderProductServiceError>()(
  "PaymentProviderProductServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Payment provider product validation error */
export class PaymentProviderProductValidationError extends Schema.TaggedErrorClass<PaymentProviderProductValidationError>()(
  "PaymentProviderProductValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 }
) {}

/** Payment provider product not found */
export class PaymentProviderProductNotFoundError extends Schema.TaggedErrorClass<PaymentProviderProductNotFoundError>()(
  "PaymentProviderProductNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}
