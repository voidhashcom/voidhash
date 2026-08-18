import { describe, expect, it } from "vitest";

import { correlateStoreNotification, normalizeStoreLifecycleState, projectStoreNotification, type StoreNotificationType } from "../../../src/domain/measurement/StoreLifecycle";

const purchases = [
  { accountToken: "account-1", environment: "production" as const, installationId: "install-account", originalTransactionId: "original-1", personId: "person-current", purchaseToken: "purchase-1", transactionId: "transaction-1" },
  { accountToken: "account-sandbox", environment: "sandbox" as const, installationId: "install-sandbox", originalTransactionId: "original-sandbox" },
];

const notification = (overrides = {}) => ({
  environment: "production" as const,
  notificationId: "notification-1",
  provider: "apple" as const,
  type: "renewed" as const,
  ...overrides,
});

describe("store notification correlation", () => {
  it("uses account, lineage, then transaction precedence", () => {
    expect(correlateStoreNotification(notification({ accountToken: "account-1", originalTransactionId: "wrong" }), purchases)).toMatchObject({ key: "account-token", installationId: "install-account" });
    expect(correlateStoreNotification(notification({ originalTransactionId: "original-1" }), purchases)).toMatchObject({ key: "lineage" });
    expect(correlateStoreNotification(notification({ transactionId: "transaction-1" }), purchases)).toMatchObject({ key: "transaction" });
    expect(correlateStoreNotification(notification({ transactionId: "missing" }), purchases)).toEqual({ status: "unmatched", reason: "purchase-evidence-not-found" });
  });

  it.each([
    ["purchased", "active"], ["renewed", "renewed"], ["canceled", "canceled"],
    ["grace-period", "grace"], ["billing-retry", "billing-retry"], ["paused", "paused"],
    ["resumed", "resumed"], ["replaced", "replaced"], ["refunded", "refunded"],
    ["revoked", "revoked"], ["expired", "expired"], ["prepaid-top-up", "prepaid"],
  ] as const)("normalizes %s", (input, expected) => {
    expect(normalizeStoreLifecycleState(input as StoreNotificationType)).toBe(expected);
  });

  it("parks an early notification and converges on replay without duplicates", () => {
    const current = notification({ accountToken: "account-1" });
    expect(projectStoreNotification(current, [], new Set())).toEqual({ status: "parked" });
    const projected = projectStoreNotification(current, purchases, new Set());
    expect(projected).toMatchObject({ status: "projected", projection: { personId: "person-current", source: "server-correlation", state: "renewed" } });
    expect(projectStoreNotification(current, purchases, new Set(["notification-1"]))).toEqual({ status: "duplicate" });
    expect(JSON.stringify(projected)).not.toMatch(/receipt|purchaseToken|accountToken/);
  });

  it("never merges sandbox notification state into production", () => {
    expect(correlateStoreNotification(notification({ accountToken: "account-sandbox" }), purchases)).toEqual({
      status: "unmatched",
      reason: "environment-mismatch",
    });
  });
});
