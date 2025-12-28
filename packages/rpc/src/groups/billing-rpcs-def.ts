import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  BillingServiceError,
  InvalidBillingTierError,
  OrganizationBillingNotFoundError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const UsageSummary = Schema.Struct({
  metricId: Schema.String,
  metricName: Schema.String,
  currentValue: Schema.Number,
  limit: Schema.NullOr(Schema.Number),
  percentUsed: Schema.NullOr(Schema.Number),
  isOverLimit: Schema.Boolean,
  isApproachingLimit: Schema.Boolean
});

export const OrganizationBillingInfo = Schema.Struct({
  organizationId: Schema.String,
  tier: Schema.Literal('free', 'pro', 'enterprise'),
  subscriptionStatus: Schema.Literal(
    'none',
    'active',
    'canceled',
    'past_due',
    'trialing'
  ),
  currentPeriodStart: Schema.NullOr(Schema.Date),
  currentPeriodEnd: Schema.NullOr(Schema.Date),
  usageSummaries: Schema.Array(UsageSummary)
});

export const CheckoutSession = Schema.Struct({
  id: Schema.String,
  url: Schema.String
});

export class BillingRpcsDef extends RpcGroup.make(
  Rpc.make('GetOrganizationBilling', {
    success: OrganizationBillingInfo,
    payload: {
      organizationId: Schema.String
    },
    error: Schema.Union(
      BillingServiceError,
      OrganizationBillingNotFoundError,
      ActionForbiddenError
    )
  }),
  Rpc.make('GetUsageSummaries', {
    success: Schema.Array(UsageSummary),
    payload: {
      organizationId: Schema.String
    },
    error: Schema.Union(BillingServiceError, ActionForbiddenError)
  }),
  Rpc.make('CreateCheckoutSession', {
    success: CheckoutSession,
    payload: {
      organizationId: Schema.String,
      tier: Schema.Literal('pro', 'enterprise'),
      successUrl: Schema.String,
      cancelUrl: Schema.String
    },
    error: Schema.Union(
      BillingServiceError,
      OrganizationBillingNotFoundError,
      InvalidBillingTierError,
      ActionForbiddenError
    )
  }),
  Rpc.make('CancelSubscription', {
    success: Schema.Void,
    payload: {
      organizationId: Schema.String
    },
    error: Schema.Union(
      BillingServiceError,
      OrganizationBillingNotFoundError,
      ActionForbiddenError
    )
  })
).middleware(AuthMiddleware) {}
