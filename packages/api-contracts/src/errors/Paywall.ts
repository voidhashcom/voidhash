import * as Schema from "effect/Schema";

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

/**
 * A release could not be created or read: the snapshot host was unreachable,
 * the caller is not a real user (releases record an author), or a stored draft
 * is malformed. Publishing failures surface as {@link ApiPaywallPublishError}.
 */
export class ApiPaywallReleaseError extends Schema.TaggedErrorClass<ApiPaywallReleaseError>()(
  "Api/PaywallReleaseError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Paywall release not found */
export class ApiPaywallReleaseNotFoundError extends Schema.TaggedErrorClass<ApiPaywallReleaseNotFoundError>()(
  "Api/PaywallReleaseNotFoundError",
  {
    releaseId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}
