/**
 * Paywall domain — typed errors that signal a paywall invariant violation.
 * Row data lives in the `paywalls` Drizzle table.
 *
 * Note: paywall-location, paywall-release, and paywall-publish errors live
 * with their respective services (`paywall-locations/`, `paywall-publishing/`).
 */
import * as Schema from "effect/Schema";

/** Paywall row not found in the database. */
export class PaywallNotFoundError extends Schema.TaggedErrorClass<PaywallNotFoundError>(
  "PaywallNotFoundError",
)("PaywallNotFoundError", { message: Schema.String }) {}

/** Paywall slug uniqueness invariant violated within a project. */
export class PaywallSlugAlreadyExistsError extends Schema.TaggedErrorClass<PaywallSlugAlreadyExistsError>(
  "PaywallSlugAlreadyExistsError",
)("PaywallSlugAlreadyExistsError", { slug: Schema.String }) {}
