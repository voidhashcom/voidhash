import { Schema } from "effect";

export class BillingServiceError extends Schema.TaggedError<BillingServiceError>()(
  "BillingServiceError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}

export class OrganizationBillingNotFoundError extends Schema.TaggedError<OrganizationBillingNotFoundError>()(
  "OrganizationBillingNotFoundError",
  {
    organizationId: Schema.String,
  }
) {}

export class InvalidBillingTierError extends Schema.TaggedError<InvalidBillingTierError>()(
  "InvalidBillingTierError",
  {
    message: Schema.String,
    tier: Schema.String,
  }
) {}
