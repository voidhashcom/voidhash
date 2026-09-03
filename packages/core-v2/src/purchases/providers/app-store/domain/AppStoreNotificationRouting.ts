import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/**
 * Purchase action an App Store server notification maps to. `informational`
 * notifications are recorded in the notification ledger only; `ignored`
 * notifications are acknowledged without any record.
 */
export const AppStoreNotificationRoute = Schema.Literals([
  "purchase",
  "renewal",
  "expired",
  "cancel_at_period_end",
  "auto_renew_resumed",
  "refund",
  "revoke",
  "refund_reversed",
  "billing_retry",
  "extended",
  "renewal_pref_change",
  "offer_redeemed",
  "price_increase",
  "informational",
  "ignored",
]);
export type AppStoreNotificationRoute = typeof AppStoreNotificationRoute.Type;

/**
 * Decision table from Apple's `notificationType` / `subtype` pair to the
 * purchase action to record. Kept free of the App Store SDK so the routing
 * rules are owned by the purchase core and testable without decoding a JWS.
 *
 * `DID_CHANGE_RENEWAL_PREF` splits on subtype: an `UPGRADE` takes effect
 * immediately and the signed transaction already belongs to the new product,
 * so it is applied as a renewal (the state machine re-points the series);
 * a `DOWNGRADE` only takes effect at the next renewal and records the
 * pending preference.
 */
const ROUTES_BY_NOTIFICATION_TYPE: Readonly<Record<string, AppStoreNotificationRoute>> = {
  CONSUMPTION_REQUEST: "informational",
  DID_FAIL_TO_RENEW: "billing_retry",
  DID_RENEW: "renewal",
  EXPIRED: "expired",
  EXTERNAL_PURCHASE_TOKEN: "informational",
  GRACE_PERIOD_EXPIRED: "expired",
  OFFER_REDEEMED: "offer_redeemed",
  ONE_TIME_CHARGE: "purchase",
  PRICE_INCREASE: "price_increase",
  REFUND: "refund",
  REFUND_DECLINED: "informational",
  REFUND_REVERSED: "refund_reversed",
  RENEWAL_EXTENDED: "extended",
  RENEWAL_EXTENSION: "extended",
  RESCIND_CONSENT: "informational",
  REVOKE: "revoke",
  SUBSCRIBED: "purchase",
};

const RENEWAL_STATUS_ROUTES_BY_SUBTYPE: Readonly<Record<string, AppStoreNotificationRoute>> = {
  AUTO_RENEW_DISABLED: "cancel_at_period_end",
  AUTO_RENEW_ENABLED: "auto_renew_resumed",
};

export const routeAppStoreNotification = (input: {
  readonly notificationType: string;
  readonly subtype: Option.Option<string>;
}): AppStoreNotificationRoute => {
  if (input.notificationType === "DID_CHANGE_RENEWAL_STATUS") {
    return Option.match(input.subtype, {
      onNone: () => "ignored" as const,
      onSome: (subtype) => RENEWAL_STATUS_ROUTES_BY_SUBTYPE[subtype] ?? "ignored",
    });
  }
  if (input.notificationType === "DID_CHANGE_RENEWAL_PREF") {
    if (Option.contains(input.subtype, "UPGRADE")) return "renewal";
    return "renewal_pref_change";
  }
  return ROUTES_BY_NOTIFICATION_TYPE[input.notificationType] ?? "ignored";
};

/**
 * The product a renewal-preference change targets. Apple carries the next
 * product on the renewal info (`autoRenewProductId`); the signed transaction
 * still references the product currently billed, so it is only a fallback
 * for payloads without renewal info.
 */
export const resolveAppStoreRenewalPreferenceProduct = (input: {
  readonly autoRenewProductId: Option.Option<string>;
  readonly transactionProductId: Option.Option<string>;
}): Option.Option<string> =>
  Option.firstSomeOf([input.autoRenewProductId, input.transactionProductId]);

/** Whether Apple's `SUBSCRIBED` / SDK transaction is a renewal rather than a first purchase. */
export const isAppStoreRenewalTransaction = (input: {
  readonly subtype: Option.Option<string>;
  readonly transactionReason: Option.Option<string>;
}): boolean =>
  Option.contains(input.subtype, "RESUBSCRIBE") ||
  Option.contains(input.transactionReason, "RENEWAL");
