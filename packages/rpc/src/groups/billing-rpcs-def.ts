import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  BillingServiceError,
  InvalidBillingTierError,
  OrganizationBillingNotFoundError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const UsageSummary = Schema.Struct({
  currentValue: Schema.Number,
  isApproachingLimit: Schema.Boolean,
  isOverLimit: Schema.Boolean,
  limit: Schema.NullOr(Schema.Number),
  metricId: Schema.String,
  metricName: Schema.String,
  percentUsed: Schema.NullOr(Schema.Number),
});

export const OrganizationBillingInfo = Schema.Struct({
  currentPeriodEnd: Schema.NullOr(Schema.Date),
  currentPeriodStart: Schema.NullOr(Schema.Date),
  organizationId: Schema.String,
  subscriptionStatus: Schema.Literal(
    "none",
    "active",
    "canceled",
    "past_due",
    "trialing"
  ),
  tier: Schema.Literal("free", "pro", "enterprise"),
  usageSummaries: Schema.Array(UsageSummary),
});

export const CheckoutSession = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
});

export class BillingRpcsDef extends RpcGroup.make(
  Rpc.make("GetOrganizationBilling", {
    error: Schema.Union(
      BillingServiceError,
      OrganizationBillingNotFoundError,
      ActionForbiddenError
    ),
    payload: {
      organizationId: Schema.String,
    },
    success: OrganizationBillingInfo,
  }),
  Rpc.make("GetUsageSummaries", {
    error: Schema.Union(BillingServiceError, ActionForbiddenError),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Array(UsageSummary),
  }),
  Rpc.make("CreateCheckoutSession", {
    error: Schema.Union(
      BillingServiceError,
      OrganizationBillingNotFoundError,
      InvalidBillingTierError,
      ActionForbiddenError
    ),
    payload: {
      cancelUrl: Schema.String,
      organizationId: Schema.String,
      successUrl: Schema.String,
      tier: Schema.Literal("pro", "enterprise"),
    },
    success: CheckoutSession,
  }),
  Rpc.make("CancelSubscription", {
    error: Schema.Union(
      BillingServiceError,
      OrganizationBillingNotFoundError,
      ActionForbiddenError
    ),
    payload: {
      organizationId: Schema.String,
    },
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
