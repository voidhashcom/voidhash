import { Schema } from 'effect';

export class BillingServiceError extends Schema.TaggedError<BillingServiceError>()(
  'BillingServiceError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String)
  }
) {}

export class BillingProviderError extends Schema.TaggedError<BillingProviderError>()(
  'BillingProviderError',
  {
    message: Schema.String,
    provider: Schema.String,
    cause: Schema.optional(Schema.String)
  }
) {}

export class UsageLimitWarning extends Schema.TaggedError<UsageLimitWarning>()(
  'UsageLimitWarning',
  {
    metricId: Schema.String,
    currentValue: Schema.Number,
    limit: Schema.Number,
    message: Schema.String
  }
) {}

export class OrganizationBillingNotFoundError extends Schema.TaggedError<OrganizationBillingNotFoundError>()(
  'OrganizationBillingNotFoundError',
  {
    organizationId: Schema.String
  }
) {}

export class InvalidBillingTierError extends Schema.TaggedError<InvalidBillingTierError>()(
  'InvalidBillingTierError',
  {
    tier: Schema.String,
    message: Schema.String
  }
) {}
