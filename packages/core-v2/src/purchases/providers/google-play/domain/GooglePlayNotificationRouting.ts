import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

/** Purchase action a Google Play real-time developer notification maps to. */
export const GooglePlayNotificationRoute = Schema.Literals([
  "purchase",
  "renewal",
  "cancel_at_period_end",
  "billing_retry",
  "auto_renew_resumed",
  "price_increase",
  "extended",
  "revoke",
  "expired",
  "refund",
  "informational",
  "ignored",
]);
export type GooglePlayNotificationRoute = typeof GooglePlayNotificationRoute.Type;

/**
 * Google Play `SubscriptionNotification.notificationType` values.
 * https://developer.android.com/google/play/billing/rtdn-reference
 */
export const GooglePlaySubscriptionNotificationType = {
  Recovered: 1,
  Renewed: 2,
  Canceled: 3,
  Purchased: 4,
  OnHold: 5,
  InGracePeriod: 6,
  Restarted: 7,
  PriceChangeConfirmed: 8,
  Deferred: 9,
  Paused: 10,
  PauseScheduleChanged: 11,
  Revoked: 12,
  Expired: 13,
} as const;

/** Google Play `OneTimeProductNotification.notificationType` values. */
export const GooglePlayOneTimeProductNotificationType = {
  Purchased: 1,
  Canceled: 2,
} as const;

/** Google Play `VoidedPurchaseNotification.refundType` values. */
export const GooglePlayVoidedPurchaseRefundType = {
  FullRefund: 1,
  QuantityBasedPartialRefund: 2,
} as const;

/** Decoded notification shape the router needs; the transport decodes the full payload. */
export type GooglePlayNotificationKind =
  | { readonly type: "subscription"; readonly notificationType: number }
  | { readonly type: "oneTimeProduct"; readonly notificationType: number }
  | { readonly type: "voidedPurchase"; readonly refundType: number }
  | { readonly type: "test" };

/**
 * Decision table from a decoded Google Play notification to the purchase
 * action to record. Pause notifications carry no entitlement change and are
 * only ledgered.
 */
const SUBSCRIPTION_ROUTES: Readonly<Record<number, GooglePlayNotificationRoute>> = {
  [GooglePlaySubscriptionNotificationType.Canceled]: "cancel_at_period_end",
  [GooglePlaySubscriptionNotificationType.Deferred]: "extended",
  [GooglePlaySubscriptionNotificationType.Expired]: "expired",
  [GooglePlaySubscriptionNotificationType.InGracePeriod]: "billing_retry",
  [GooglePlaySubscriptionNotificationType.OnHold]: "billing_retry",
  [GooglePlaySubscriptionNotificationType.PriceChangeConfirmed]: "price_increase",
  [GooglePlaySubscriptionNotificationType.Purchased]: "purchase",
  [GooglePlaySubscriptionNotificationType.Recovered]: "renewal",
  [GooglePlaySubscriptionNotificationType.Renewed]: "renewal",
  [GooglePlaySubscriptionNotificationType.Restarted]: "auto_renew_resumed",
  [GooglePlaySubscriptionNotificationType.Revoked]: "revoke",
};

export const routeGooglePlayNotification = (
  notification: GooglePlayNotificationKind,
): GooglePlayNotificationRoute =>
  Match.value(notification).pipe(
    Match.when(
      { type: "subscription" },
      (subscription) => SUBSCRIPTION_ROUTES[subscription.notificationType] ?? "informational",
    ),
    Match.when({ type: "oneTimeProduct" }, (oneTime) => {
      if (oneTime.notificationType === GooglePlayOneTimeProductNotificationType.Purchased) {
        return "purchase" as const;
      }
      return "refund" as const;
    }),
    Match.when({ type: "voidedPurchase" }, (voided) => {
      if (voided.refundType === GooglePlayVoidedPurchaseRefundType.QuantityBasedPartialRefund) {
        return "revoke" as const;
      }
      return "refund" as const;
    }),
    Match.when({ type: "test" }, () => "ignored" as const),
    Match.exhaustive,
  );
