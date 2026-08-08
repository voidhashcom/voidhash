import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storekit = vi.hoisted(() => ({
  buyProduct: vi.fn(),
  endConnection: vi.fn(),
  finishTransaction: vi.fn(),
  getItems: vi.fn(),
  getPendingTransactions: vi.fn(),
  getPurchasedItems: vi.fn(),
  initConnection: vi.fn(),
  presentCodeRedemptionSheet: vi.fn(),
  showManageSubscriptions: vi.fn(),
}));

vi.mock("../../src/nitro", () => ({ Storekit: storekit }));

import type { SubscriptionProduct } from "../../src/core/entities/product";
import { AppStoreAdapter } from "../../src/core/payment-adapters/app-store-adapter";
import { PaymentAdapter } from "../../src/core/payment-adapters/payment-adapter";

const nativeTransaction = (overrides: Record<string, unknown> = {}) => ({
  appAccountToken: "3501e751-7582-58f9-9c1d-533c7466049f",
  appBundleIdIos: "com.voidhash.test",
  currencyIos: "USD",
  id: "com.voidhash.monthly.ios",
  ids: ["com.voidhash.monthly.ios"],
  originalTransactionDateIos: 1_700_000_000_000,
  originalTransactionIdentifierIos: "original-1",
  ownershipTypeIos: "purchased",
  productTypeIos: "autoRenewable",
  quantityIos: 1,
  transactionDate: 1_700_000_000_000,
  transactionId: "transaction-1",
  transactionReceipt: "signed-transaction",
  ...overrides,
});

const product = {
  id: "com.voidhash.monthly.ios",
  slug: "monthly_sub",
  type: "subscription",
} as SubscriptionProduct;

const runWithAdapter = <A>(effect: Effect.Effect<A, unknown, PaymentAdapter>) =>
  Effect.runPromise(effect.pipe(Effect.provide(AppStoreAdapter)));

describe("AppStoreAdapter", () => {
  // oxlint-disable-next-line effect/noTestLifecycleHooks -- vitest module-mock reset: `vi.clearAllMocks` plus the per-test default return values operate on hoisted `vi.mock` factories, which live outside any Effect scope; effect-bun-test scoped tests cannot reach them.
  beforeEach(() => {
    vi.clearAllMocks();
    storekit.buyProduct.mockResolvedValue(nativeTransaction());
    storekit.endConnection.mockResolvedValue(true);
    storekit.finishTransaction.mockResolvedValue(undefined);
    storekit.getItems.mockResolvedValue([]);
    storekit.getPendingTransactions.mockReturnValue([]);
    storekit.getPurchasedItems.mockResolvedValue([]);
    storekit.initConnection.mockResolvedValue(true);
    storekit.showManageSubscriptions.mockResolvedValue(undefined);
  });

  it("passes and preserves the app account token across purchase mapping", async () => {
    const transaction = await runWithAdapter(
      Effect.gen(function* () {
        const adapter = yield* PaymentAdapter;
        return yield* adapter.buyProduct(product, 1, "3501e751-7582-58f9-9c1d-533c7466049f");
      }),
    );

    expect(storekit.buyProduct).toHaveBeenCalledWith(
      "com.voidhash.monthly.ios",
      "3501e751-7582-58f9-9c1d-533c7466049f",
      1,
    );
    expect(transaction.appAccountToken).toBe("3501e751-7582-58f9-9c1d-533c7466049f");
  });

  it("finishes the exact transaction returned by StoreKit", async () => {
    await runWithAdapter(
      Effect.gen(function* () {
        const adapter = yield* PaymentAdapter;
        const transaction = yield* adapter.buyProduct(product);
        yield* adapter.acknowledgePurchase(transaction);
      }),
    );

    expect(storekit.finishTransaction).toHaveBeenCalledWith("transaction-1");
  });

  it("restores transactions without requiring a prior product fetch", async () => {
    storekit.getPurchasedItems.mockResolvedValue([nativeTransaction()]);

    const transactions = await runWithAdapter(
      Effect.gen(function* () {
        const adapter = yield* PaymentAdapter;
        return yield* adapter.getPurchaseHistory(true);
      }),
    );

    expect(storekit.getItems).not.toHaveBeenCalled();
    expect(transactions.map((transaction) => transaction.transactionId)).toEqual(["transaction-1"]);
  });
});
