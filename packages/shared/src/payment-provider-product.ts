import { Schema } from "effect";

export class PaymentProviderProductServiceError extends Schema.TaggedError<PaymentProviderProductServiceError>()(
  "PaymentProviderProductServiceError",
  {
    cause: Schema.String,
  }
) {}

export class PaymentProviderProductValidationError extends Schema.TaggedError<PaymentProviderProductValidationError>()(
  "PaymentProviderProductValidationError",
  {
    message: Schema.String,
  }
) {}

export class PaymentProviderProductNotFoundError extends Schema.TaggedError<PaymentProviderProductNotFoundError>()(
  "PaymentProviderProductNotFoundError",
  {
    message: Schema.String,
  }
) {}
