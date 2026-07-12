/**
 * Pure unit tests for the per-action revenue analytics mappers. Each mapper
 * translates a successful purchase write into one or more
 * `InternalAnalyticsEvent` shapes; there is no Effect, no infra, and no DB —
 * just deterministic object construction with three load-bearing concerns:
 *
 *   1. the sign convention applied to the money payload (+1 for
 *      purchases / renewals / refund-reversals, −1 for refunds / revokes),
 *   2. the `Option` gates that turn a missing transaction / subscription id
 *      into an empty array (no-op) for some mappers,
 *   3. DETERMINISTIC `eventId`s (derived from `(idempotencyKey, eventName,
 *      personId)`) and the shared `context` / envelope fields.
 */
import { Option } from "effect";

import { describe, expect, it } from "vite-plus/test";

import { REVENUE_TRUSTED_SOURCE_TOPIC } from "../../../src/domain/internalAnalytics/InternalAnalyticsEvents.ts";
import {
  PurchaseProcessingMoney,
  PurchaseProcessingMoneyUsd,
} from "../../../src/domain/purchaseProcessing/PurchaseProcessing.ts";
import { CurrencyCode, ExchangeRate, MinorAmount } from "../../../src/domain/shared/Money.ts";
import {
  type RevenueAnalyticsMapperContext,
  toAutoRenewResumedAnalyticsInputs,
  toBillingRetryAnalyticsInputs,
  toCanceledAnalyticsInputs,
  toExpiredAnalyticsInputs,
  toExtendedAnalyticsInputs,
  toOfferRedeemedAnalyticsInputs,
  toOneTimePurchaseAnalyticsInputs,
  toPriceIncreaseAnalyticsInputs,
  toPurchaseRevokedAnalyticsInputs,
  toPurchaseTransferredAnalyticsInputs,
  toRefundedAnalyticsInputs,
  toRefundReversedAnalyticsInputs,
  toRenewalPreferenceChangeAnalyticsInputs,
  toRenewedAnalyticsInputs,
  toRevokedAnalyticsInputs,
  toStartedAnalyticsInputs,
  toSubscriptionTransferredAnalyticsInputs,
} from "../../../src/services/purchaseProcessing/revenue-analytics-mapper.ts";

const cfg = (
  overrides: Partial<RevenueAnalyticsMapperContext> = {},
): RevenueAnalyticsMapperContext => ({
  distinctId: "dist_test",
  idempotencyKey: "idem_test",
  organizationId: "org_test",
  projectId: "proj_test",
  token: "tok_test",
  ...overrides,
});

const common = () => ({
  paymentProviderConfigurationId: "pp_conf_1",
  paymentProviderConfigurationProductId: "pp_prod_1",
  providerEnvironment: 1,
  providerEventType: "subscription.started",
  providerId: "apple",
  providerSubscriptionId: Option.some("store_sub_1"),
  providerTransactionId: Option.some("store_tx_1"),
  providerWebhookNotificationId: Option.some("wh_1"),
  source: "webhook",
});

/**
 * Builds a fully-populated {@link PurchaseProcessingMoney} (with the USD
 * breakdown) so the mappers exercise every breakdown column. All amounts are
 * non-negative minor units — the mappers apply the sign.
 */
const moneyWithUsd = () =>
  new PurchaseProcessingMoney({
    currency: CurrencyCode.make("EUR"),
    grossAmount: MinorAmount.make(1_000),
    proceedsAfterTaxAmount: MinorAmount.make(600),
    proceedsAmount: MinorAmount.make(700),
    storeCommissionAmount: MinorAmount.make(300),
    storefront: Option.some("DEU"),
    taxAmount: MinorAmount.make(100),
    usd: Option.some(
      new PurchaseProcessingMoneyUsd({
        exchangeRate: ExchangeRate.make(1_100_000),
        grossAmount: MinorAmount.make(1_100),
        proceedsAfterTaxAmount: MinorAmount.make(660),
        proceedsAmount: MinorAmount.make(770),
        storeCommissionAmount: MinorAmount.make(330),
        taxAmount: MinorAmount.make(110),
      }),
    ),
  });

/** Money with no USD mirror (FX rate was unavailable). */
const moneyNoUsd = () =>
  new PurchaseProcessingMoney({
    currency: CurrencyCode.make("USD"),
    grossAmount: MinorAmount.make(999),
    proceedsAfterTaxAmount: MinorAmount.make(699),
    proceedsAmount: MinorAmount.make(699),
    storeCommissionAmount: MinorAmount.make(300),
    storefront: Option.some("USA"),
    taxAmount: MinorAmount.make(0),
    usd: Option.none(),
  });

const at = (iso: string) => new Date(iso);

describe("toStartedAnalyticsInputs", () => {
  it("returns an empty array (no-op) when the transaction id is absent", () => {
    const events = toStartedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("emits the [subscription.created, purchase.completed] pair anchored on the new transaction id", () => {
    const events = toStartedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.eventName)).toEqual([
      "$subscription.created",
      "$purchase.completed",
    ]);
    for (const e of events) {
      expect(e.transactionId).toBe("tx_42");
      expect(e.personId).toBe("person_1");
      // distinctId is the cfg's resolved primary distinct id, NOT the personId.
      expect(e.distinctId).toBe("dist_test");
    }
  });

  it("applies sign=+1 so purchase deltas stay positive", () => {
    const [created] = toStartedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    expect(created?.properties.grossAmount).toBe(1_000);
    expect(created?.properties.amount).toBe(1_000);
    expect(created?.properties.grossAmountUsd).toBe(1_100);
    expect(created?.properties.amountUsd).toBe(1_100);
    expect(created?.properties.proceedsAmount).toBe(700);
  });

  it("passes isTrial through to both events", () => {
    const events = toStartedAnalyticsInputs(
      {
        ...common(),
        isTrial: true,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    expect(events.map((e) => e.properties.isTrial)).toEqual([true, true]);
  });
});

describe("toRenewedAnalyticsInputs", () => {
  it("returns an empty array when the transaction id is absent", () => {
    const events = toRenewedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("emits a single $subscription.renewed with a +1 (positive) money delta", () => {
    const events = toRenewedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.some("tx_renew") },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [renewed] = events;
    expect(renewed?.eventName).toBe("$subscription.renewed");
    expect(renewed?.transactionId).toBe("tx_renew");
    expect(renewed?.properties.grossAmount).toBe(1_000);
    expect(renewed?.properties.isTrial).toBe(false);
  });
});

describe("toCanceledAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toCanceledAnalyticsInputs(
      {
        ...common(),
        cancelAtPeriodEnd: true,
        canceledAt: at("2026-01-01"),
        cancellationReason: Option.some("user_request"),
      },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("emits $subscription.canceled with no money fields and the cancellation reason", () => {
    const events = toCanceledAnalyticsInputs(
      {
        ...common(),
        cancelAtPeriodEnd: true,
        canceledAt: at("2026-01-01"),
        cancellationReason: Option.some("user_request"),
      },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [canceled] = events;
    expect(canceled?.eventName).toBe("$subscription.canceled");
    expect(canceled?.transactionId).toBeNull();
    expect(canceled?.properties.cancelAtPeriodEnd).toBe(true);
    expect(canceled?.properties.cancellationReason).toBe("user_request");
    // user cancels never carry money — Apple keeps the entitlement to period end.
    expect(canceled?.properties.grossAmount).toBeUndefined();
  });

  it("nulls the cancellation reason when none is supplied", () => {
    const [canceled] = toCanceledAnalyticsInputs(
      {
        ...common(),
        cancelAtPeriodEnd: false,
        canceledAt: at("2026-01-01"),
        cancellationReason: Option.none(),
      },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(canceled?.properties.cancellationReason).toBeNull();
  });
});

describe("toExpiredAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toExpiredAnalyticsInputs(
      { ...common(), expiredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("emits $subscription.expired with only the base properties (no money)", () => {
    const events = toExpiredAnalyticsInputs(
      { ...common(), expiredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [expired] = events;
    expect(expired?.eventName).toBe("$subscription.expired");
    expect(expired).toBeDefined();
    expect("grossAmount" in (expired?.properties ?? {})).toBe(false);
    expect("amount" in (expired?.properties ?? {})).toBe(false);
  });
});

describe("toRevokedAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toRevokedAnalyticsInputs(
      {
        ...common(),
        money: Option.some(moneyWithUsd()),
        revocationReason: Option.some("FAMILY_SHARING_REVOKED"),
        revokedAt: at("2026-01-01"),
      },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("emits a $subscription.canceled with sign=−1 (negative) money deltas and the revocation reason", () => {
    const events = toRevokedAnalyticsInputs(
      {
        ...common(),
        money: Option.some(moneyWithUsd()),
        revocationReason: Option.some("FAMILY_SHARING_REVOKED"),
        revokedAt: at("2026-01-01"),
      },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [canceled] = events;
    expect(canceled?.eventName).toBe("$subscription.canceled");
    expect(canceled?.properties.revocationReason).toBe("FAMILY_SHARING_REVOKED");
    expect(canceled?.properties.grossAmount).toBe(-1_000);
    expect(canceled?.properties.amount).toBe(-1_000);
    expect(canceled?.properties.grossAmountUsd).toBe(-1_100);
    expect(canceled?.properties.proceedsAmount).toBe(-700);
  });
});

describe("toOneTimePurchaseAnalyticsInputs", () => {
  it("returns an empty array when the transaction id is absent", () => {
    const events = toOneTimePurchaseAnalyticsInputs(
      {
        ...common(),
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
        purchaseType: "one-time",
      },
      { personId: "person_1", transactionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it.each(["one-time", "consumable"] as const)(
    "emits $purchase.completed with purchaseType=%s and +1 money",
    (purchaseType) => {
      const events = toOneTimePurchaseAnalyticsInputs(
        {
          ...common(),
          money: Option.some(moneyWithUsd()),
          occurredAt: at("2026-01-01"),
          purchaseType,
        },
        { personId: "person_1", transactionId: Option.some("tx_otp") },
        cfg(),
      );
      expect(events).toHaveLength(1);
      const [completed] = events;
      expect(completed?.eventName).toBe("$purchase.completed");
      expect(completed?.properties.purchaseType).toBe(purchaseType);
      expect(completed?.properties.grossAmount).toBe(1_000);
    },
  );
});

describe("toRefundedAnalyticsInputs", () => {
  it("ALWAYS returns a single event (no Option gate), with sign=−1 and the refund reason", () => {
    const events = toRefundedAnalyticsInputs(
      {
        ...common(),
        money: Option.some(moneyWithUsd()),
        refundReason: Option.some("UNINTENDED_PURCHASE"),
        refundedAt: at("2026-01-01"),
      },
      { personId: "person_1" },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [refunded] = events;
    expect(refunded?.eventName).toBe("$purchase.refunded");
    expect(refunded?.properties.refundReason).toBe("UNINTENDED_PURCHASE");
    expect(refunded?.properties.grossAmount).toBe(-1_000);
    expect(refunded?.properties.grossAmountUsd).toBe(-1_100);
    // anchored on the provider transaction id from the common fields.
    expect(refunded?.transactionId).toBe("store_tx_1");
  });

  it("nulls the refund reason and transactionId when their sources are absent", () => {
    const [refunded] = toRefundedAnalyticsInputs(
      {
        ...common(),
        money: Option.none(),
        providerTransactionId: Option.none(),
        refundReason: Option.none(),
        refundedAt: at("2026-01-01"),
      },
      { personId: "person_1" },
      cfg(),
    );
    expect(refunded?.properties.refundReason).toBeNull();
    expect(refunded?.transactionId).toBeNull();
    expect(refunded?.properties.grossAmount).toBeUndefined();
  });
});

describe("toPurchaseRevokedAnalyticsInputs", () => {
  it("ALWAYS returns a single $purchase.revoked with sign=−1", () => {
    const events = toPurchaseRevokedAnalyticsInputs(
      {
        ...common(),
        money: Option.some(moneyWithUsd()),
        revocationReason: Option.some("REFUND"),
        revokedAt: at("2026-01-01"),
      },
      { personId: "person_1" },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [revoked] = events;
    expect(revoked?.eventName).toBe("$purchase.revoked");
    expect(revoked?.properties.revocationReason).toBe("REFUND");
    expect(revoked?.properties.grossAmount).toBe(-1_000);
    expect(revoked?.properties.proceedsAmount).toBe(-700);
  });
});

describe("toRefundReversedAnalyticsInputs", () => {
  it("ALWAYS returns a single $subscription.refund_reversed with sign=+1 (cancels the prior refund delta)", () => {
    const events = toRefundReversedAnalyticsInputs(
      { ...common(), money: Option.some(moneyWithUsd()), reversedAt: at("2026-01-01") },
      { personId: "person_1" },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [reversed] = events;
    expect(reversed?.eventName).toBe("$subscription.refund_reversed");
    expect(reversed?.properties.grossAmount).toBe(1_000);
    expect(reversed?.properties.grossAmountUsd).toBe(1_100);
    expect(reversed?.transactionId).toBe("store_tx_1");
  });
});

describe("toBillingRetryAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toBillingRetryAnalyticsInputs(
      {
        ...common(),
        gracePeriodExpiresAt: Option.some(at("2026-02-01")),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("includes the gracePeriodExpiresAt Date when present", () => {
    const grace = at("2026-02-01");
    const [retry] = toBillingRetryAnalyticsInputs(
      { ...common(), gracePeriodExpiresAt: Option.some(grace), occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(retry?.eventName).toBe("$subscription.billing_retry");
    expect(retry?.properties.gracePeriodExpiresAt).toEqual(grace);
  });

  it("nulls gracePeriodExpiresAt when none is supplied", () => {
    const [retry] = toBillingRetryAnalyticsInputs(
      { ...common(), gracePeriodExpiresAt: Option.none(), occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(retry?.properties.gracePeriodExpiresAt).toBeNull();
  });
});

describe("toExtendedAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toExtendedAnalyticsInputs(
      { ...common(), extendedTo: at("2026-03-01"), occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("includes the extendedTo Date", () => {
    const extendedTo = at("2026-03-01");
    const [extended] = toExtendedAnalyticsInputs(
      { ...common(), extendedTo, occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(extended?.eventName).toBe("$subscription.extended");
    expect(extended?.properties.extendedTo).toEqual(extendedTo);
  });
});

describe("toRenewalPreferenceChangeAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toRenewalPreferenceChangeAnalyticsInputs(
      { ...common(), newProviderProductKey: "premium_yearly", occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("includes the newProviderProductKey", () => {
    const [changed] = toRenewalPreferenceChangeAnalyticsInputs(
      { ...common(), newProviderProductKey: "premium_yearly", occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(changed?.eventName).toBe("$subscription.product_changed");
    expect(changed?.properties.newProviderProductKey).toBe("premium_yearly");
  });
});

describe("toOfferRedeemedAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toOfferRedeemedAnalyticsInputs(
      { ...common(), occurredAt: at("2026-01-01"), offerId: Option.some("winback_2026") },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("includes the offerId when present and nulls it when absent", () => {
    const [withOffer] = toOfferRedeemedAnalyticsInputs(
      { ...common(), occurredAt: at("2026-01-01"), offerId: Option.some("winback_2026") },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(withOffer?.eventName).toBe("$subscription.offer_redeemed");
    expect(withOffer?.properties.offerId).toBe("winback_2026");

    const [noOffer] = toOfferRedeemedAnalyticsInputs(
      { ...common(), occurredAt: at("2026-01-01"), offerId: Option.none() },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(noOffer?.properties.offerId).toBeNull();
  });
});

describe("toPriceIncreaseAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toPriceIncreaseAnalyticsInputs(
      {
        ...common(),
        effectiveAt: Option.some(at("2026-04-01")),
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("uses an UNSIGNED (+1) breakdown — the upcoming price is informational, never a negative delta", () => {
    const effectiveAt = at("2026-04-01");
    const [priceIncrease] = toPriceIncreaseAnalyticsInputs(
      {
        ...common(),
        effectiveAt: Option.some(effectiveAt),
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(priceIncrease?.eventName).toBe("$subscription.price_increase_pending");
    expect(priceIncrease?.properties.grossAmount).toBe(1_000);
    expect(priceIncrease?.properties.grossAmountUsd).toBe(1_100);
    expect(priceIncrease?.properties.effectiveAt).toEqual(effectiveAt);
  });
});

describe("toAutoRenewResumedAnalyticsInputs", () => {
  it("returns an empty array when the subscription id is absent", () => {
    const events = toAutoRenewResumedAnalyticsInputs(
      { ...common(), occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.none() },
      cfg(),
    );
    expect(events).toEqual([]);
  });

  it("emits a minimal $subscription.auto_renew_resumed with no money", () => {
    const events = toAutoRenewResumedAnalyticsInputs(
      { ...common(), occurredAt: at("2026-01-01") },
      { personId: "person_1", subscriptionId: Option.some("sub_1") },
      cfg(),
    );
    expect(events).toHaveLength(1);
    const [resumed] = events;
    expect(resumed?.eventName).toBe("$subscription.auto_renew_resumed");
    expect("grossAmount" in (resumed?.properties ?? {})).toBe(false);
  });
});

const transferModeInput = () => ({
  fromDistinctId: "dist_from",
  fromPersonId: "person_from",
  occurredAt: at("2026-01-01"),
  paymentProviderConfigurationId: "pp_conf_1",
  providerId: "apple",
  source: "webhook",
  toDistinctId: "dist_to",
  toPersonId: "person_to",
  transferMode: "transfer_to_new_owner" as const,
  triggerReason: "restore_on_shared_device",
});

describe("toSubscriptionTransferredAnalyticsInputs", () => {
  it("emits the [transferred_out, transferred_in] pair with source / target identities on the envelope and shared properties", () => {
    const events = toSubscriptionTransferredAnalyticsInputs(
      {
        ...transferModeInput(),
        subscription: {
          id: "sub_1",
          paymentProviderConfigurationProductId: "pp_prod_1",
          providerEnvironment: 1,
          storeSubscriptionId: "store_sub_1",
        },
      },
      cfg(),
    );
    expect(events).toHaveLength(2);
    const [out, inn] = events;
    expect(out?.eventName).toBe("$subscription.transferred_out");
    expect(inn?.eventName).toBe("$subscription.transferred_in");

    // the _out event is anchored on the SOURCE identity, _in on the TARGET.
    expect(out?.distinctId).toBe("dist_from");
    expect(out?.personId).toBe("person_from");
    expect(inn?.distinctId).toBe("dist_to");
    expect(inn?.personId).toBe("person_to");

    // both halves carry the SAME properties so a consumer can correlate them.
    expect(out?.properties).toEqual(inn?.properties);
    expect(out?.properties.subscriptionId).toBe("sub_1");
    expect(out?.properties.storeSubscriptionId).toBe("store_sub_1");
    expect(out?.properties.providerEventType).toBe("subscription.transferred");
    expect(out?.properties.transferMode).toBe("transfer_to_new_owner");
  });
});

describe("toPurchaseTransferredAnalyticsInputs", () => {
  it("emits the [transferred_out, transferred_in] pair carrying the purchase provider key", () => {
    const events = toPurchaseTransferredAnalyticsInputs(
      {
        ...transferModeInput(),
        purchase: {
          id: "pur_1",
          paymentProviderConfigurationProductId: "pp_prod_1",
          providerEnvironment: 1,
          providerKey: "com.app.lifetime",
        },
      },
      cfg(),
    );
    expect(events).toHaveLength(2);
    const [out, inn] = events;
    expect(out?.eventName).toBe("$purchase.transferred_out");
    expect(inn?.eventName).toBe("$purchase.transferred_in");
    expect(out?.distinctId).toBe("dist_from");
    expect(inn?.distinctId).toBe("dist_to");
    expect(out?.properties).toEqual(inn?.properties);
    expect(out?.properties.purchaseId).toBe("pur_1");
    expect(out?.properties.providerKey).toBe("com.app.lifetime");
    expect(out?.properties.providerEventType).toBe("purchase.transferred");
  });
});

describe("cross-cutting mapper invariants", () => {
  it("derives a DETERMINISTIC eventId — stable across repeated calls, distinct per (eventName) within a call", () => {
    const args = [
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    ] as const;
    const first = toStartedAnalyticsInputs(...args);
    const second = toStartedAnalyticsInputs(...args);
    // The two events in one call differ ONLY by eventName, so they get two
    // distinct (stable) ids; re-running with the same (anchor, eventName,
    // personId) reproduces those SAME two ids — the property the at-least-once
    // queue dedup relies on.
    expect(first.map((e) => e.eventId)).toEqual(second.map((e) => e.eventId));
    expect(new Set(first.map((e) => e.eventId)).size).toBe(2);
    for (const id of [...first, ...second].map((e) => e.eventId)) {
      expect(id).toMatch(/^an_evt_/);
    }
  });

  it("changing the idempotencyKey anchor OR the personId changes every derived eventId", () => {
    const input = {
      ...common(),
      isTrial: false,
      money: Option.none(),
      occurredAt: at("2026-01-01"),
    };
    const baseline = toStartedAnalyticsInputs(
      input,
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    ).map((e) => e.eventId);
    const otherAnchor = toStartedAnalyticsInputs(
      input,
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg({ idempotencyKey: "idem_other" }),
    ).map((e) => e.eventId);
    const otherPerson = toStartedAnalyticsInputs(
      input,
      { personId: "person_2", transactionId: Option.some("tx_42") },
      cfg(),
    ).map((e) => e.eventId);
    expect(otherAnchor).not.toEqual(baseline);
    expect(otherPerson).not.toEqual(baseline);
  });

  it("stamps the envelope with the trusted source topic, org / project / token from cfg", () => {
    const [created] = toStartedAnalyticsInputs(
      { ...common(), isTrial: false, money: Option.none(), occurredAt: at("2026-01-01") },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    expect(created?.context).toEqual({ sourceTopic: REVENUE_TRUSTED_SOURCE_TOPIC });
    expect(created?.organizationId).toBe("org_test");
    expect(created?.projectId).toBe("proj_test");
    expect(created?.token).toBe("tok_test");
    expect(created?.occurredAt).toEqual(at("2026-01-01"));
  });

  it("maps the common provider fields through revenuePropertiesBase, nulling absent Options", () => {
    const [created] = toStartedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.none(),
        occurredAt: at("2026-01-01"),
        providerSubscriptionId: Option.none(),
        providerTransactionId: Option.none(),
        providerWebhookNotificationId: Option.none(),
      },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    expect(created?.properties.paymentProviderConfigurationId).toBe("pp_conf_1");
    expect(created?.properties.providerId).toBe("apple");
    expect(created?.properties.providerSubscriptionId).toBeNull();
    expect(created?.properties.providerTransactionId).toBeNull();
    expect(created?.properties.providerWebhookNotificationId).toBeNull();
  });
});

describe("signedMoneyProperties (exercised via toStartedAnalyticsInputs)", () => {
  it("Option.none() money → no money fields on the event at all", () => {
    const [created] = toStartedAnalyticsInputs(
      { ...common(), isTrial: false, money: Option.none(), occurredAt: at("2026-01-01") },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    const props = created?.properties ?? {};
    expect("grossAmount" in props).toBe(false);
    expect("amount" in props).toBe(false);
    expect("currency" in props).toBe(false);
    // non-money base fields are still present.
    expect(props).toHaveProperty("providerId");
  });

  it("sign=+1 yields positive amounts, sign=−1 yields negative amounts for the same money", () => {
    const money = moneyWithUsd();
    const [positive] = toStartedAnalyticsInputs(
      { ...common(), isTrial: false, money: Option.some(money), occurredAt: at("2026-01-01") },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    const [negative] = toPurchaseRevokedAnalyticsInputs(
      {
        ...common(),
        money: Option.some(money),
        revocationReason: Option.none(),
        revokedAt: at("2026-01-01"),
      },
      { personId: "person_1" },
      cfg(),
    );
    expect(positive?.properties.grossAmount).toBe(1_000);
    expect(negative?.properties.grossAmount).toBe(-1_000);
    expect(positive?.properties.taxAmount).toBe(100);
    expect(negative?.properties.taxAmount).toBe(-100);
  });

  it("includes the USD breakdown (exchangeRate, *Usd) only when the money carries a USD mirror", () => {
    const [withUsd] = toStartedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyWithUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    expect(withUsd?.properties.exchangeRate).toBe(1_100_000);
    expect(withUsd?.properties.grossAmountUsd).toBe(1_100);
    expect(withUsd?.properties.proceedsAmountUsd).toBe(770);

    const [noUsd] = toStartedAnalyticsInputs(
      {
        ...common(),
        isTrial: false,
        money: Option.some(moneyNoUsd()),
        occurredAt: at("2026-01-01"),
      },
      { personId: "person_1", transactionId: Option.some("tx_42") },
      cfg(),
    );
    // original-currency amounts are present, USD mirror is nulled.
    expect(noUsd?.properties.grossAmount).toBe(999);
    expect(noUsd?.properties.exchangeRate).toBeNull();
    expect(noUsd?.properties.grossAmountUsd).toBeNull();
    expect(noUsd?.properties.amountUsd).toBeNull();
    expect(noUsd?.properties.proceedsAmountUsd).toBeNull();
  });
});

/**
 * Enumerates EVERY mapper to lock the injectivity contract behind the
 * deterministic `event_id`: the triple `(idempotencyKey, eventName, personId)`
 * must be collision-free across all current variants. Each builder runs under a
 * DISTINCT anchor (mirroring reality — one purchase-ledger row, one unique
 * `idempotency_key`, per action). If two different events ever produced the same
 * derived id, the at-least-once queue dedup would silently drop a real event.
 */
describe("deterministic eventId injectivity (enumeration over every mapper)", () => {
  // Runs all 17 mappers with a per-builder anchor and returns every event.
  const enumerateAll = () => {
    const subResult = (p = "person_1") => ({ personId: p, subscriptionId: Option.some("sub_1") });
    const txResult = (p = "person_1") => ({ personId: p, transactionId: Option.some("tx_1") });
    const base = { ...common(), occurredAt: at("2026-01-01"), money: Option.some(moneyWithUsd()) };
    const transferSub = {
      ...transferModeInput(),
      subscription: {
        id: "sub_1",
        paymentProviderConfigurationProductId: "pp_prod_1",
        providerEnvironment: 1,
        storeSubscriptionId: "store_sub_1",
      },
    };
    const transferPur = {
      ...transferModeInput(),
      purchase: {
        id: "pur_1",
        paymentProviderConfigurationProductId: "pp_prod_1",
        providerEnvironment: 1,
        providerKey: "com.app.lifetime",
      },
    };
    return [
      toStartedAnalyticsInputs(
        { ...base, isTrial: false },
        txResult(),
        cfg({ idempotencyKey: "k_started" }),
      ),
      toRenewedAnalyticsInputs(
        { ...base, isTrial: true },
        txResult(),
        cfg({ idempotencyKey: "k_renewed" }),
      ),
      toCanceledAnalyticsInputs(
        {
          ...common(),
          canceledAt: at("2026-01-01"),
          cancelAtPeriodEnd: true,
          cancellationReason: Option.none(),
        },
        subResult(),
        cfg({ idempotencyKey: "k_canceled" }),
      ),
      toExpiredAnalyticsInputs(
        { ...common(), expiredAt: at("2026-01-01") },
        subResult(),
        cfg({ idempotencyKey: "k_expired" }),
      ),
      toRevokedAnalyticsInputs(
        { ...base, revokedAt: at("2026-01-01"), revocationReason: Option.none() },
        subResult(),
        cfg({ idempotencyKey: "k_revoked" }),
      ),
      toOneTimePurchaseAnalyticsInputs(
        { ...base, purchaseType: "one-time" },
        txResult(),
        cfg({ idempotencyKey: "k_otp" }),
      ),
      toRefundedAnalyticsInputs(
        { ...base, refundedAt: at("2026-01-01"), refundReason: Option.none() },
        { personId: "person_1" },
        cfg({ idempotencyKey: "k_refunded" }),
      ),
      toPurchaseRevokedAnalyticsInputs(
        { ...base, revokedAt: at("2026-01-01"), revocationReason: Option.none() },
        { personId: "person_1" },
        cfg({ idempotencyKey: "k_pur_revoked" }),
      ),
      toRefundReversedAnalyticsInputs(
        { ...base, reversedAt: at("2026-01-01") },
        { personId: "person_1" },
        cfg({ idempotencyKey: "k_refund_reversed" }),
      ),
      toBillingRetryAnalyticsInputs(
        { ...common(), occurredAt: at("2026-01-01"), gracePeriodExpiresAt: Option.none() },
        subResult(),
        cfg({ idempotencyKey: "k_billing_retry" }),
      ),
      toExtendedAnalyticsInputs(
        { ...common(), occurredAt: at("2026-01-01"), extendedTo: at("2026-03-01") },
        subResult(),
        cfg({ idempotencyKey: "k_extended" }),
      ),
      toRenewalPreferenceChangeAnalyticsInputs(
        { ...common(), occurredAt: at("2026-01-01"), newProviderProductKey: "premium_yearly" },
        subResult(),
        cfg({ idempotencyKey: "k_product_changed" }),
      ),
      toOfferRedeemedAnalyticsInputs(
        { ...common(), occurredAt: at("2026-01-01"), offerId: Option.none() },
        subResult(),
        cfg({ idempotencyKey: "k_offer" }),
      ),
      toPriceIncreaseAnalyticsInputs(
        { ...base, effectiveAt: Option.none() },
        subResult(),
        cfg({ idempotencyKey: "k_price_increase" }),
      ),
      toAutoRenewResumedAnalyticsInputs(
        { ...common(), occurredAt: at("2026-01-01") },
        subResult(),
        cfg({ idempotencyKey: "k_auto_renew" }),
      ),
      toSubscriptionTransferredAnalyticsInputs(
        transferSub,
        cfg({ idempotencyKey: "k_sub_transfer" }),
      ),
      toPurchaseTransferredAnalyticsInputs(transferPur, cfg({ idempotencyKey: "k_pur_transfer" })),
    ].flat();
  };

  it("produces a UNIQUE eventId for every event across all mappers", () => {
    const ids = enumerateAll().map((e) => e.eventId);
    // 14 single-event builders + 2 (started) + 2 (sub transfer) + 2 (pur transfer) = 20 events.
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is fully deterministic — re-running every mapper reproduces the identical id set", () => {
    expect(enumerateAll().map((e) => e.eventId)).toEqual(enumerateAll().map((e) => e.eventId));
  });

  it("disambiguates the two halves of each multi-event action by eventName / personId", () => {
    const started = toStartedAnalyticsInputs(
      { ...common(), isTrial: false, money: Option.none(), occurredAt: at("2026-01-01") },
      { personId: "person_1", transactionId: Option.some("tx_1") },
      cfg({ idempotencyKey: "k_started" }),
    );
    // same anchor + same personId, different eventName → distinct ids.
    expect(started[0]?.eventId).not.toBe(started[1]?.eventId);

    const transfer = toSubscriptionTransferredAnalyticsInputs(
      {
        ...transferModeInput(),
        subscription: {
          id: "sub_1",
          paymentProviderConfigurationProductId: "pp_prod_1",
          providerEnvironment: 1,
          storeSubscriptionId: "store_sub_1",
        },
      },
      cfg({ idempotencyKey: "k_sub_transfer" }),
    );
    // same anchor, different eventName AND personId → distinct ids.
    expect(transfer[0]?.eventId).not.toBe(transfer[1]?.eventId);
  });
});
