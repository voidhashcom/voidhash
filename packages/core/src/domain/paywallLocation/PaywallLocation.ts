/**
 * Paywall-location domain — typed errors that signal an invariant violation
 * on a paywall location or its active showing. Row data lives in the
 * `paywallLocations` Drizzle table.
 */
import * as Schema from "effect/Schema";

/** Location row not found in the database. */
export class PaywallLocationNotFoundError extends Schema.TaggedErrorClass<PaywallLocationNotFoundError>(
  "PaywallLocationNotFoundError",
)("PaywallLocationNotFoundError", { message: Schema.String }) {}

/** Slug uniqueness invariant violated within a project. */
export class PaywallLocationSlugAlreadyExistsError extends Schema.TaggedErrorClass<PaywallLocationSlugAlreadyExistsError>(
  "PaywallLocationSlugAlreadyExistsError",
)("PaywallLocationSlugAlreadyExistsError", { slug: Schema.String }) {}

/** Showing-assignment input failed validation (missing paywall, archived location, …). */
export class PaywallLocationShowingValidationError extends Schema.TaggedErrorClass<PaywallLocationShowingValidationError>(
  "PaywallLocationShowingValidationError",
)("PaywallLocationShowingValidationError", { message: Schema.String }) {}
