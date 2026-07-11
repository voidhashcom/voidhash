/**
 * Organization domain — typed error that signals an organization invariant
 * violation. Row data lives in the `organization` Drizzle table.
 */
import { Schema } from "effect";

/** Organization row not found in the database. */
export class OrganizationNotFoundError extends Schema.TaggedErrorClass<OrganizationNotFoundError>(
  "OrganizationNotFoundError",
)("OrganizationNotFoundError", { organizationId: Schema.String }) {}
