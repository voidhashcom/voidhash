import { Schema } from "effect";

/** Generic paywall service error */
export class ApiPaywallServiceError extends Schema.TaggedErrorClass<ApiPaywallServiceError>()(
  "Api/PaywallServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Paywall not found */
export class ApiPaywallNotFoundError extends Schema.TaggedErrorClass<ApiPaywallNotFoundError>()(
  "Api/PaywallNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Paywall slug already exists */
export class ApiPaywallSlugAlreadyExistsError extends Schema.TaggedErrorClass<ApiPaywallSlugAlreadyExistsError>()(
  "Api/PaywallSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  { httpApiStatus: 409 },
) {}

/** Paywall publish error */
export class ApiPaywallPublishError extends Schema.TaggedErrorClass<ApiPaywallPublishError>()(
  "Api/PaywallPublishError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 500 },
) {}
