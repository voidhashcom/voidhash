import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

/** Generic paywall service error */
export class PaywallServiceError extends Schema.TaggedError<PaywallServiceError>()(
  "PaywallServiceError",
  {
    cause: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/** Paywall not found */
export class PaywallNotFoundError extends Schema.TaggedError<PaywallNotFoundError>()(
  "PaywallNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/** Paywall slug already exists */
export class PaywallSlugAlreadyExistsError extends Schema.TaggedError<PaywallSlugAlreadyExistsError>()(
  "PaywallSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/** Paywall publish error */
export class PaywallPublishError extends Schema.TaggedError<PaywallPublishError>()(
  "PaywallPublishError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}
