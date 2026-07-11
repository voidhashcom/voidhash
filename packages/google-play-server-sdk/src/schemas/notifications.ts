import { Schema } from "effect";

import { OneTimeProductNotificationType, SubscriptionNotificationType } from "./enums.ts";

/**
 * Subscription notification from RTDN
 */
export const SubscriptionNotification = Schema.Struct({
  version: Schema.optional(Schema.String),
  notificationType: SubscriptionNotificationType,
  purchaseToken: Schema.String,
  subscriptionId: Schema.String,
});

export type SubscriptionNotification = typeof SubscriptionNotification.Type;

/**
 * One-time product notification from RTDN
 */
export const OneTimeProductNotification = Schema.Struct({
  version: Schema.optional(Schema.String),
  notificationType: OneTimeProductNotificationType,
  purchaseToken: Schema.String,
  sku: Schema.String,
});

export type OneTimeProductNotification = typeof OneTimeProductNotification.Type;

/**
 * Voided purchase notification from RTDN
 */
export const VoidedPurchaseNotification = Schema.Struct({
  purchaseToken: Schema.String,
  orderId: Schema.optional(Schema.String),
  productType: Schema.optional(Schema.Number), // 1=Subscription, 2=OneTime
  refundType: Schema.optional(Schema.Number), // 1=FullRefund, 2=Revoke
});

export type VoidedPurchaseNotification = typeof VoidedPurchaseNotification.Type;

/**
 * Test notification from RTDN
 */
export const TestNotification = Schema.Struct({
  version: Schema.optional(Schema.String),
});

export type TestNotification = typeof TestNotification.Type;

/**
 * Developer notification (root RTDN message)
 */
export const DeveloperNotification = Schema.Struct({
  version: Schema.optional(Schema.String),
  packageName: Schema.String,
  eventTimeMillis: Schema.optional(Schema.String),
  subscriptionNotification: Schema.optional(SubscriptionNotification),
  oneTimeProductNotification: Schema.optional(OneTimeProductNotification),
  voidedPurchaseNotification: Schema.optional(VoidedPurchaseNotification),
  testNotification: Schema.optional(TestNotification),
});

export type DeveloperNotification = typeof DeveloperNotification.Type;
