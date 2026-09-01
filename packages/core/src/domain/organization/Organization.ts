/**
 * Organization domain — typed error that signals an organization invariant
 * violation. Row data lives in the `organization` Drizzle table.
 */
import * as Schema from "effect/Schema";

/** Organization row not found in the database. */
export class OrganizationNotFoundError extends Schema.TaggedErrorClass<OrganizationNotFoundError>(
  "OrganizationNotFoundError",
)("OrganizationNotFoundError", { organizationId: Schema.String }) {}
