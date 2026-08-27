import { Schema } from "effect";

/**
 * Subscription states from SubscriptionPurchaseV2
 */
export const SubscriptionState = Schema.Union([
  Schema.Literal("SUBSCRIPTION_STATE_UNSPECIFIED"),
  Schema.Literal("SUBSCRIPTION_STATE_PENDING"),
  Schema.Literal("SUBSCRIPTION_STATE_ACTIVE"),
  Schema.Literal("SUBSCRIPTION_STATE_PAUSED"),
  Schema.Literal("SUBSCRIPTION_STATE_IN_GRACE_PERIOD"),
  Schema.Literal("SUBSCRIPTION_STATE_ON_HOLD"),
  Schema.Literal("SUBSCRIPTION_STATE_CANCELED"),
  Schema.Literal("SUBSCRIPTION_STATE_EXPIRED"),
  Schema.Literal("SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"),
]);

export type SubscriptionState = typeof SubscriptionState.Type;

/**
 * Acknowledgement states
 */
export const AcknowledgementState = Schema.Union([
  Schema.Literal("ACKNOWLEDGEMENT_STATE_UNSPECIFIED"),
  Schema.Literal("ACKNOWLEDGEMENT_STATE_PENDING"),
  Schema.Literal("ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"),
]);

export type AcknowledgementState = typeof AcknowledgementState.Type;

/**
 * Purchase states for products
 */
export const PurchaseState = Schema.Union([
  Schema.Literal("PURCHASE_STATE_UNSPECIFIED"),
  Schema.Literal("PURCHASED"),
  Schema.Literal("CANCELLED"),
  Schema.Literal("PENDING"),
]);

export type PurchaseState = typeof PurchaseState.Type;

/**
 * Consumption states for consumable products
 */
export const ConsumptionState = Schema.Union([
  Schema.Literal("CONSUMPTION_STATE_UNSPECIFIED"),
  Schema.Literal("CONSUMPTION_STATE_YET_TO_BE_CONSUMED"),
  Schema.Literal("CONSUMPTION_STATE_CONSUMED"),
]);

export type ConsumptionState = typeof ConsumptionState.Type;

/**
 * Base plan states
 */
export const BasePlanState = Schema.Union([
  Schema.Literal("STATE_UNSPECIFIED"),
  Schema.Literal("DRAFT"),
  Schema.Literal("ACTIVE"),
  Schema.Literal("INACTIVE"),
]);

export type BasePlanState = typeof BasePlanState.Type;

/**
 * Subscription notification types (1-13)
 */
export const SubscriptionNotificationType = Schema.Union([
  Schema.Literal(1), // SUBSCRIPTION_RECOVERED
  Schema.Literal(2), // SUBSCRIPTION_RENEWED
  Schema.Literal(3), // SUBSCRIPTION_CANCELED
  Schema.Literal(4), // SUBSCRIPTION_PURCHASED
  Schema.Literal(5), // SUBSCRIPTION_ON_HOLD
  Schema.Literal(6), // SUBSCRIPTION_IN_GRACE_PERIOD
  Schema.Literal(7), // SUBSCRIPTION_RESTARTED
  Schema.Literal(8), // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
  Schema.Literal(9), // SUBSCRIPTION_DEFERRED
  Schema.Literal(10), // SUBSCRIPTION_PAUSED
  Schema.Literal(11), // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
  Schema.Literal(12), // SUBSCRIPTION_REVOKED
  Schema.Literal(13), // SUBSCRIPTION_EXPIRED
]);

export type SubscriptionNotificationType = typeof SubscriptionNotificationType.Type;

/**
 * One-time product notification types
 */
export const OneTimeProductNotificationType = Schema.Union([
  Schema.Literal(1), // ONE_TIME_PRODUCT_PURCHASED
  Schema.Literal(2), // ONE_TIME_PRODUCT_CANCELED
]);

export type OneTimeProductNotificationType = typeof OneTimeProductNotificationType.Type;
