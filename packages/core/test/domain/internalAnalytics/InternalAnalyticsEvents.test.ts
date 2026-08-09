import { constant } from "@voidhash/lib/lang";
import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  type InternalAnalyticsEvent,
  isReservedRevenueEventName,
  RESERVED_REVENUE_EVENT_NAMES,
  REVENUE_TRUSTED_SOURCE_TOPIC,
  type RevenueAnalyticsEventName,
  RevenueAnalyticsEventNameSchema,
  shouldBypassQuota,
  sourceTopicForInternalAnalyticsEvent,
  TRUST_BYPASS_QUOTA,
} from "../../../src/domain/internalAnalytics/InternalAnalyticsEvents.ts";

/** Every wire-stable revenue event name, sourced from the schema literals so a
 * future addition to the union forces these tests to consider it. */
const ALL_REVENUE_EVENT_NAMES: ReadonlyArray<RevenueAnalyticsEventName> =
  RevenueAnalyticsEventNameSchema.literals;

/** The fields every variant shares; `sourceTopicForInternalAnalyticsEvent`
 * only reads `eventName`, so a minimal-but-valid base is sufficient. */
const FIXED_OCCURRED_AT = DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"));

const baseEvent = () => ({
  context: undefined,
  distinctId: "person_distinct",
  eventId: "evt_1",
  occurredAt: FIXED_OCCURRED_AT,
  organizationId: "org_1",
  personId: "person_1",
  projectId: "project_1",
  token: "tok_1",
  transactionId: null,
});

const revenuePropertiesBase = () => ({
  paymentProviderConfigurationId: "ppc_1",
  paymentProviderConfigurationProductId: "ppcp_1",
  providerEnvironment: 1,
  providerEventType: "TEST",
  providerId: "appstore",
  providerSubscriptionId: null,
  providerTransactionId: null,
  providerWebhookNotificationId: null,
  source: "test",
});

const transferPropertiesBase = () => ({
  paymentProviderConfigurationId: "ppc_1",
  paymentProviderConfigurationProductId: "ppcp_1",
  providerId: "appstore",
  providerEnvironment: 1,
  source: "test",
  providerEventType: "TEST",
  fromDistinctId: "from_distinct",
  fromPersonId: "from_person",
  toDistinctId: "to_distinct",
  toPersonId: "to_person",
  transferMode: constant("transfer_to_new_owner"),
  transferReason: "restore",
  transferredAt: FIXED_OCCURRED_AT,
});

const purchaseCompleted = (): InternalAnalyticsEvent => ({
  ...baseEvent(),
  eventName: "$purchase.completed",
  properties: { ...revenuePropertiesBase() },
});

const subscriptionCreated = (): InternalAnalyticsEvent => ({
  ...baseEvent(),
  eventName: "$subscription.created",
  properties: { ...revenuePropertiesBase(), isTrial: false },
});

const subscriptionTransferredIn = (): InternalAnalyticsEvent => ({
  ...baseEvent(),
  eventName: "$subscription.transferred_in",
  properties: { ...transferPropertiesBase() },
});

const purchaseTransferredOut = (): InternalAnalyticsEvent => ({
  ...baseEvent(),
  eventName: "$purchase.transferred_out",
  properties: { ...transferPropertiesBase() },
});

/** Every variant's property fields merged — a superset each variant accepts. */
const allProperties = () => ({
  ...transferPropertiesBase(),
  ...revenuePropertiesBase(),
  effectiveAt: FIXED_OCCURRED_AT,
  extendedTo: FIXED_OCCURRED_AT,
  gracePeriodExpiresAt: null,
  newProviderProductKey: "prod_new",
  offerId: null,
  isTrial: false,
  refundReason: null,
  revocationReason: null,
});

/**
 * One builder per reserved event name. Keyed by the literal union so adding a
 * name to {@link RevenueAnalyticsEventNameSchema} fails to compile until it is
 * covered here, which is what drives the exhaustiveness assertion below.
 */
const EVENT_BUILDER_BY_NAME: {
  readonly [N in RevenueAnalyticsEventName]: () => InternalAnalyticsEvent;
} = {
  "$purchase.completed": () => ({
    ...baseEvent(),
    eventName: "$purchase.completed",
    properties: allProperties(),
  }),
  "$purchase.refunded": () => ({
    ...baseEvent(),
    eventName: "$purchase.refunded",
    properties: allProperties(),
  }),
  "$purchase.revoked": () => ({
    ...baseEvent(),
    eventName: "$purchase.revoked",
    properties: allProperties(),
  }),
  "$purchase.transferred_out": () => ({
    ...baseEvent(),
    eventName: "$purchase.transferred_out",
    properties: allProperties(),
  }),
  "$purchase.transferred_in": () => ({
    ...baseEvent(),
    eventName: "$purchase.transferred_in",
    properties: allProperties(),
  }),
  "$subscription.created": () => ({
    ...baseEvent(),
    eventName: "$subscription.created",
    properties: allProperties(),
  }),
  "$subscription.renewed": () => ({
    ...baseEvent(),
    eventName: "$subscription.renewed",
    properties: allProperties(),
  }),
  "$subscription.canceled": () => ({
    ...baseEvent(),
    eventName: "$subscription.canceled",
    properties: allProperties(),
  }),
  "$subscription.expired": () => ({
    ...baseEvent(),
    eventName: "$subscription.expired",
    properties: allProperties(),
  }),
  "$subscription.active": () => ({
    ...baseEvent(),
    eventName: "$subscription.active",
    properties: allProperties(),
  }),
  "$subscription.refund_reversed": () => ({
    ...baseEvent(),
    eventName: "$subscription.refund_reversed",
    properties: allProperties(),
  }),
  "$subscription.billing_retry": () => ({
    ...baseEvent(),
    eventName: "$subscription.billing_retry",
    properties: allProperties(),
  }),
  "$subscription.extended": () => ({
    ...baseEvent(),
    eventName: "$subscription.extended",
    properties: allProperties(),
  }),
  "$subscription.product_changed": () => ({
    ...baseEvent(),
    eventName: "$subscription.product_changed",
    properties: allProperties(),
  }),
  "$subscription.offer_redeemed": () => ({
    ...baseEvent(),
    eventName: "$subscription.offer_redeemed",
    properties: allProperties(),
  }),
  "$subscription.price_increase_pending": () => ({
    ...baseEvent(),
    eventName: "$subscription.price_increase_pending",
    properties: allProperties(),
  }),
  "$subscription.auto_renew_resumed": () => ({
    ...baseEvent(),
    eventName: "$subscription.auto_renew_resumed",
    properties: allProperties(),
  }),
  "$subscription.transferred_out": () => ({
    ...baseEvent(),
    eventName: "$subscription.transferred_out",
    properties: allProperties(),
  }),
  "$subscription.transferred_in": () => ({
    ...baseEvent(),
    eventName: "$subscription.transferred_in",
    properties: allProperties(),
  }),
};

describe("isReservedRevenueEventName", () => {
  it("returns true for '$purchase.completed'", () => {
    expect(isReservedRevenueEventName("$purchase.completed")).toBe(true);
  });

  it("returns true for '$subscription.created'", () => {
    expect(isReservedRevenueEventName("$subscription.created")).toBe(true);
  });

  it.each(ALL_REVENUE_EVENT_NAMES)("returns true for the reserved name %s", (name) => {
    expect(isReservedRevenueEventName(name)).toBe(true);
  });

  it("recognizes the full reserved set with no extras", () => {
    // The reserved set and the schema literals must stay in lock-step; a drift
    // in either direction (a missing or stray name) is a trust-boundary bug.
    expect(RESERVED_REVENUE_EVENT_NAMES.size).toBe(ALL_REVENUE_EVENT_NAMES.length);
    for (const name of ALL_REVENUE_EVENT_NAMES) {
      expect(RESERVED_REVENUE_EVENT_NAMES.has(name)).toBe(true);
    }
  });

  it.each([
    "purchase.completed", // missing the reserved `$` prefix
    "$purchase.completed.extra",
    "checkout_started",
    "$unknown.event",
    "",
  ])("returns false for the non-reserved name %j", (name) => {
    expect(isReservedRevenueEventName(name)).toBe(false);
  });

  it("is case-sensitive and exact (no normalization)", () => {
    expect(isReservedRevenueEventName("$Purchase.Completed")).toBe(false);
    expect(isReservedRevenueEventName(" $purchase.completed")).toBe(false);
  });
});

describe("sourceTopicForInternalAnalyticsEvent", () => {
  it("returns REVENUE_TRUSTED_SOURCE_TOPIC for purchase events", () => {
    expect(sourceTopicForInternalAnalyticsEvent(purchaseCompleted())).toBe(
      REVENUE_TRUSTED_SOURCE_TOPIC,
    );
  });

  it("returns REVENUE_TRUSTED_SOURCE_TOPIC for subscription events", () => {
    expect(sourceTopicForInternalAnalyticsEvent(subscriptionCreated())).toBe(
      REVENUE_TRUSTED_SOURCE_TOPIC,
    );
  });

  it("returns REVENUE_TRUSTED_SOURCE_TOPIC for subscription transfer events", () => {
    expect(sourceTopicForInternalAnalyticsEvent(subscriptionTransferredIn())).toBe(
      REVENUE_TRUSTED_SOURCE_TOPIC,
    );
  });

  it("returns REVENUE_TRUSTED_SOURCE_TOPIC for purchase transfer events", () => {
    expect(sourceTopicForInternalAnalyticsEvent(purchaseTransferredOut())).toBe(
      REVENUE_TRUSTED_SOURCE_TOPIC,
    );
  });

  it("maps every reserved event name to the trusted source topic", () => {
    // Drive the mapper by eventName alone (the only field it reads) across the
    // full union so a new variant that forgets a `case` is caught here.
    for (const name of ALL_REVENUE_EVENT_NAMES) {
      const event = EVENT_BUILDER_BY_NAME[name]();
      expect(sourceTopicForInternalAnalyticsEvent(event)).toBe(REVENUE_TRUSTED_SOURCE_TOPIC);
    }
  });

  it("pins the trusted source topic constant value", () => {
    expect(REVENUE_TRUSTED_SOURCE_TOPIC).toBe("revenue.trusted.v1");
  });
});

describe("shouldBypassQuota", () => {
  it("always exempts trusted-revenue events", () => {
    expect(
      shouldBypassQuota({ trustClass: "trusted-revenue", eventName: "$purchase.completed" }),
    ).toBe(true);
    expect(shouldBypassQuota({ trustClass: "trusted-revenue", eventName: "anything" })).toBe(true);
  });

  it("does NOT exempt untrusted-sdk events by default (empty allowlist → behaviour unchanged)", () => {
    expect(shouldBypassQuota({ trustClass: "untrusted-sdk", eventName: "checkout_started" })).toBe(
      false,
    );
    expect(shouldBypassQuota({ eventName: "page_view" })).toBe(false);
  });

  it("exempts a name once it is added to TRUST_BYPASS_QUOTA", () => {
    // The allowlist ships empty; this proves the seam works without coupling the
    // test to a specific entry.
    const probe = "vh_test_bypass_probe";
    expect(shouldBypassQuota({ trustClass: "untrusted-sdk", eventName: probe })).toBe(
      TRUST_BYPASS_QUOTA.has(probe),
    );
  });

  it("ships with an empty SDK allowlist", () => {
    expect(TRUST_BYPASS_QUOTA.size).toBe(0);
  });
});
