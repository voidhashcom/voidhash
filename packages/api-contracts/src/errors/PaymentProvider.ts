import { Schema } from "effect";

/** Generic payment provider configuration service error */
export class ApiPaymentProviderConfigurationServiceError extends Schema.TaggedErrorClass<ApiPaymentProviderConfigurationServiceError>()(
  "Api/PaymentProviderConfigurationServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Payment provider configuration not found */
export class ApiPaymentProviderConfigurationNotFoundError extends Schema.TaggedErrorClass<ApiPaymentProviderConfigurationNotFoundError>()(
  "Api/PaymentProviderConfigurationNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Payment provider configuration validation error */
export class ApiPaymentProviderConfigurationValidationError extends Schema.TaggedErrorClass<ApiPaymentProviderConfigurationValidationError>()(
  "Api/PaymentProviderConfigurationValidationError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

/** Payment provider configuration key unavailable */
export class ApiPaymentProviderConfigurationKeyUnavailableError extends Schema.TaggedErrorClass<ApiPaymentProviderConfigurationKeyUnavailableError>()(
  "Api/PaymentProviderConfigurationKeyUnavailableError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

/** Payment provider already exists */
export class ApiPaymentProviderAlreadyExistsError extends Schema.TaggedErrorClass<ApiPaymentProviderAlreadyExistsError>()(
  "Api/PaymentProviderAlreadyExistsError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 409 },
) {}

/** Generic payment provider product service error */
export class ApiPaymentProviderProductServiceError extends Schema.TaggedErrorClass<ApiPaymentProviderProductServiceError>()(
  "Api/PaymentProviderProductServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Payment provider product validation error */
export class ApiPaymentProviderProductValidationError extends Schema.TaggedErrorClass<ApiPaymentProviderProductValidationError>()(
  "Api/PaymentProviderProductValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

/** Payment provider product not found */
export class ApiPaymentProviderProductNotFoundError extends Schema.TaggedErrorClass<ApiPaymentProviderProductNotFoundError>()(
  "Api/PaymentProviderProductNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}
