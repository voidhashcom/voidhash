import { Schema } from "effect";

/** Generic paywall service error */
export class PaywallServiceError extends Schema.TaggedErrorClass<PaywallServiceError>()(
  "PaywallServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 }
) {}

/** Paywall not found */
export class PaywallNotFoundError extends Schema.TaggedErrorClass<PaywallNotFoundError>()(
  "PaywallNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

/** Paywall slug already exists */
export class PaywallSlugAlreadyExistsError extends Schema.TaggedErrorClass<PaywallSlugAlreadyExistsError>()(
  "PaywallSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  { httpApiStatus: 409 }
) {}

/** Paywall publish error */
export class PaywallPublishError extends Schema.TaggedErrorClass<PaywallPublishError>()(
  "PaywallPublishError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 500 }
) {}
