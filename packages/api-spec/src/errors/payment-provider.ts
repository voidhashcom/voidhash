import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic payment provider configuration service error */
export class PaymentProviderConfigurationServiceError extends Schema.TaggedError<PaymentProviderConfigurationServiceError>()(
  "PaymentProviderConfigurationServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Payment provider configuration not found */
export class PaymentProviderConfigurationNotFoundError extends Schema.TaggedError<PaymentProviderConfigurationNotFoundError>()(
  "PaymentProviderConfigurationNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** Payment provider configuration validation error */
export class PaymentProviderConfigurationValidationError extends Schema.TaggedError<PaymentProviderConfigurationValidationError>()(
  "PaymentProviderConfigurationValidationError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/** Payment provider configuration key unavailable */
export class PaymentProviderConfigurationKeyUnavailableError extends Schema.TaggedError<PaymentProviderConfigurationKeyUnavailableError>()(
  "PaymentProviderConfigurationKeyUnavailableError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/** Payment provider already exists */
export class PaymentProviderAlreadyExistsError extends Schema.TaggedError<PaymentProviderAlreadyExistsError>()(
  "PaymentProviderAlreadyExistsError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/** Generic payment provider product service error */
export class PaymentProviderProductServiceError extends Schema.TaggedError<PaymentProviderProductServiceError>()(
  "PaymentProviderProductServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Payment provider product validation error */
export class PaymentProviderProductValidationError extends Schema.TaggedError<PaymentProviderProductValidationError>()(
  "PaymentProviderProductValidationError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/** Payment provider product not found */
export class PaymentProviderProductNotFoundError extends Schema.TaggedError<PaymentProviderProductNotFoundError>()(
  "PaymentProviderProductNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}
