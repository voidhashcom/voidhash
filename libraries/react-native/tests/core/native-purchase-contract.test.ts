import { NodeFileSystem } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";

import { describe, expect, it } from "../helpers/effect-vitest";

const readSource = (relativePath: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      return yield* fileSystem.readFileString(new URL(relativePath, import.meta.url).pathname);
    }).pipe(Effect.provide(NodeFileSystem.layer), Effect.orDie),
  );

const androidSource = await readSource(
  "../../../android/core/src/main/java/com/voidhash/core/billing/BillingEngine.kt",
);
const storekitSource = await readSource(
  "../../../ios/Sources/VoidhashCore/StoreKit/StoreKitEngine.swift",
);

describe("native purchase bridge invariants", () => {
  it("resolves Android purchase promises from PurchasesUpdatedListener", () => {
    expect(androidSource).toContain("purchaseCoordinator.begin");
    expect(androidSource).toContain("purchaseCoordinator.succeed(billingPurchases)");
    expect(androidSource).toContain("purchaseCoordinator.fail(");
    expect(androidSource).not.toContain("return@async emptyArray()");
  });

  it("uses the Google Play consume API for consumable products", () => {
    expect(androidSource).toContain("suspend fun consumeProduct");
    expect(androidSource).toContain("billingClient.consumeAsync(params)");
  });

  it("retains StoreKit transactions before returning them for finish", () => {
    expect(storekitSource).toContain(
      "transactions.retain(id: String(transaction.id), value: transaction)",
    );
    expect(storekitSource).toContain(
      "guard let transaction = transactions.value(for: transactionId)",
    );
  });

  it("does not require a prior StoreKit product fetch to restore current entitlements", () => {
    const historyBody = storekitSource.slice(
      storekitSource.indexOf("public func getPurchasedItems"),
      storekitSource.indexOf("public func buyProduct"),
    );
    expect(historyBody).not.toContain("getProduct(productID:");
    expect(historyBody).toContain("transaction.productType != .consumable");
  });
});
