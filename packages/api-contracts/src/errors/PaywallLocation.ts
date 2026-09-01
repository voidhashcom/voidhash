import * as Schema from "effect/Schema";

/** Generic paywall location service error */
export class ApiPaywallLocationServiceError extends Schema.TaggedErrorClass<ApiPaywallLocationServiceError>()(
  "Api/PaywallLocationServiceError",
  {
    cause: Schema.String,
  },
  { httpApiStatus: 500 },
) {}

/** Paywall location not found */
export class ApiPaywallLocationNotFoundError extends Schema.TaggedErrorClass<ApiPaywallLocationNotFoundError>()(
  "Api/PaywallLocationNotFoundError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

/** Paywall location slug already exists in the project */
export class ApiPaywallLocationSlugAlreadyExistsError extends Schema.TaggedErrorClass<ApiPaywallLocationSlugAlreadyExistsError>()(
  "Api/PaywallLocationSlugAlreadyExistsError",
  {
    slug: Schema.String,
  },
  { httpApiStatus: 409 },
) {}

/**
 * The requested showing is not servable: the target paywall has no published
 * release, or the payload names a target that does not match `type`.
 */
export class ApiPaywallLocationShowingValidationError extends Schema.TaggedErrorClass<ApiPaywallLocationShowingValidationError>()(
  "Api/PaywallLocationShowingValidationError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}
