import { Schema } from "effect";

export class BillingServiceError extends Schema.TaggedError<BillingServiceError>()(
  "BillingServiceError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}

export class BillingProviderError extends Schema.TaggedError<BillingProviderError>()(
  "BillingProviderError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
    provider: Schema.String,
  }
) {}

export class UsageLimitWarning extends Schema.TaggedError<UsageLimitWarning>()(
  "UsageLimitWarning",
  {
    currentValue: Schema.Number,
    limit: Schema.Number,
    message: Schema.String,
    metricId: Schema.String,
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
