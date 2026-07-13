import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const androidSource = readFileSync(
  new URL(
    "../../android/src/main/java/com/margelo/nitro/voidhash/HybridGoogleBilling.kt",
    import.meta.url,
  ),
  "utf8",
);
const storekitSource = readFileSync(
  new URL("../../ios/HybridStorekit.swift", import.meta.url),
  "utf8",
);

describe("native purchase bridge invariants", () => {
  it("resolves Android purchase promises from PurchasesUpdatedListener", () => {
    expect(androidSource).toContain("purchaseCoordinator.begin");
    expect(androidSource).toContain("purchaseCoordinator.succeed(hybridPurchases)");
    expect(androidSource).toContain("purchaseCoordinator.fail(");
    expect(androidSource).not.toContain("return@async emptyArray()");
  });

  it("uses the Google Play consume API for consumable products", () => {
    expect(androidSource).toContain("override fun consumeProduct");
    expect(androidSource).toContain("billingClient.consumeAsync(params)");
  });

  it("retains StoreKit transactions before returning them for finish", () => {
    expect(storekitSource).toContain(
      "self.transactions.retain(id: String(transaction.id), value: transaction)",
    );
    expect(storekitSource).toContain(
      "guard let transaction = self.transactions.value(for: transactionId)",
    );
  });

  it("does not require a prior StoreKit product fetch to restore current entitlements", () => {
    const historyBody = storekitSource.slice(
      storekitSource.indexOf("func getPurchasedItems"),
      storekitSource.indexOf("func buyProduct"),
    );
    expect(historyBody).not.toContain("getProduct(productID:");
    expect(historyBody).toContain("transaction.productType != .consumable");
  });
});
