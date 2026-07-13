import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const googleBilling = vi.hoisted(() => ({
  acknowledgePurchase: vi.fn(),
  buyItemByType: vi.fn(),
  consumeProduct: vi.fn(),
  endConnection: vi.fn(),
  getAvailableItemsByType: vi.fn(),
  getItemsByType: vi.fn(),
  initConnection: vi.fn(),
}));

vi.mock("../../src/nitro", () => ({ GoogleBilling: googleBilling }));

import type { SubscriptionProduct } from "../../src/core/entities/product";
import { Transaction } from "../../src/core/entities/transaction";
import { GooglePlayAdapter } from "../../src/core/payment-adapters/google-play-adapter";
import { PaymentAdapter } from "../../src/core/payment-adapters/payment-adapter";
import { createTestSchema } from "../helpers/test-schema";

const purchase = (overrides: Record<string, unknown> = {}) => ({
  developerPayload: "",
  id: "com.voidhash.yearly.android",
  ids: ["com.voidhash.yearly.android"],
  isAcknowledged: false,
  isAutoRenewing: true,
  orderId: "order-1",
  originalJson: "{}",
  packageName: "com.voidhash.test",
  purchaseState: 1,
  purchaseTime: 1_700_000_000_000,
  purchaseToken: "purchase-token",
  signature: "signature",
  ...overrides,
});

const runWithAdapter = <A>(effect: Effect.Effect<A, unknown, PaymentAdapter>) =>
  Effect.runPromise(effect.pipe(Effect.provide(GooglePlayAdapter)));

describe("GooglePlayAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    googleBilling.acknowledgePurchase.mockResolvedValue({ message: "OK", responseCode: 0 });
    googleBilling.buyItemByType.mockResolvedValue([purchase()]);
    googleBilling.consumeProduct.mockResolvedValue({ message: "OK", responseCode: 0 });
    googleBilling.endConnection.mockResolvedValue(true);
    googleBilling.getAvailableItemsByType.mockResolvedValue([]);
    googleBilling.getItemsByType.mockResolvedValue([]);
    googleBilling.initConnection.mockResolvedValue(true);
  });

  it("consumes consumable products and acknowledges durable products", async () => {
    const transaction = new Transaction(
      "order-1",
      "purchase-token",
      "coins",
      Date.now(),
      1,
      false,
      "android",
      { purchaseToken: "purchase-token" },
    );

    await runWithAdapter(
      Effect.gen(function* () {
        const adapter = yield* PaymentAdapter;
        yield* adapter.acknowledgePurchase(transaction, "one-time-consumable");
        yield* adapter.acknowledgePurchase(transaction, "one-time");
      }),
    );

    expect(googleBilling.consumeProduct).toHaveBeenCalledWith("purchase-token");
    expect(googleBilling.acknowledgePurchase).toHaveBeenCalledWith("purchase-token");
  });

  it("selects the configured base-plan offer token and sends the account token", async () => {
    googleBilling.getItemsByType.mockImplementation(async (type: string) =>
      type === "subs"
        ? [
            {
              currency: "USD",
              description: "Yearly plan",
              displayName: "Yearly",
              displayPrice: "$99.99",
              id: "com.voidhash.yearly.android",
              platform: "android",
              subscriptionOfferDetails: [
                {
                  basePlanId: "other-base",
                  offerTags: [],
                  offerToken: "wrong-offer-token",
                  pricingPhases: { pricingPhaseList: [] },
                },
                {
                  basePlanId: "yearly-base",
                  offerTags: [],
                  offerToken: "yearly-offer-token",
                  pricingPhases: { pricingPhaseList: [] },
                },
              ],
              title: "Yearly",
              type: "subs",
            },
          ]
        : [],
    );

    await runWithAdapter(
      Effect.gen(function* () {
        const adapter = yield* PaymentAdapter;
        const products = yield* adapter.getProducts(createTestSchema().products);
        const yearly = products.find((product) => product.slug === "yearly_sub");
        expect(yearly?.googlePlayOfferToken).toBe("yearly-offer-token");

        yield* adapter.buyProduct(
          yearly as SubscriptionProduct,
          1,
          "3501e751-7582-58f9-9c1d-533c7466049f",
        );
      }),
    );

    expect(googleBilling.buyItemByType).toHaveBeenCalledWith(
      expect.objectContaining({
        obfuscatedAccountId: "3501e751-7582-58f9-9c1d-533c7466049f",
        offerTokenArr: ["yearly-offer-token"],
        type: "subs",
      }),
    );
  });

  it("maps Google purchase state and obfuscated account id", async () => {
    googleBilling.getAvailableItemsByType.mockImplementation(async (type: string) =>
      type === "inapp"
        ? [
            purchase({
              obfuscatedAccountId: "account-token",
              purchaseState: 2,
            }),
          ]
        : [],
    );

    const [transaction] = await runWithAdapter(
      Effect.gen(function* () {
        const adapter = yield* PaymentAdapter;
        return yield* adapter.getPurchaseHistory(false);
      }),
    );

    expect(transaction?.appAccountToken).toBe("account-token");
    expect(transaction?.purchaseState).toBe("pending");
  });

  it("reports a pending Google purchase without granting purchase success", async () => {
    googleBilling.buyItemByType.mockResolvedValue([
      purchase({
        obfuscatedAccountId: "account-token",
        purchaseState: 2,
      }),
    ]);

    await expect(
      runWithAdapter(
        Effect.gen(function* () {
          const adapter = yield* PaymentAdapter;
          return yield* adapter.buyProduct(
            {
              googlePlayOfferToken: "offer-token",
              id: "com.voidhash.yearly.android",
              slug: "yearly_sub",
              type: "subscription",
            } as SubscriptionProduct,
            1,
            "account-token",
          );
        }),
      ),
    ).rejects.toThrow("Purchase is pending");
  });

  it("rejects a subscription before native launch when no offer token was resolved", async () => {
    await expect(
      runWithAdapter(
        Effect.gen(function* () {
          const adapter = yield* PaymentAdapter;
          return yield* adapter.buyProduct({
            id: "com.voidhash.yearly.android",
            slug: "yearly_sub",
            type: "subscription",
          } as SubscriptionProduct);
        }),
      ),
    ).rejects.toThrow("Google Play subscription has no configured offer token");
    expect(googleBilling.buyItemByType).not.toHaveBeenCalled();
  });

  it("keeps purchased one-time items active without relying on their product id", async () => {
    googleBilling.getAvailableItemsByType.mockImplementation(async (type: string) =>
      type === "inapp"
        ? [purchase({ id: "coins_forever", ids: ["coins_forever"], isAutoRenewing: undefined })]
        : [
            purchase({ id: "active-sub", ids: ["active-sub"], isAutoRenewing: true }),
            purchase({ id: "expired-sub", ids: ["expired-sub"], isAutoRenewing: false }),
          ],
    );

    const transactions = await runWithAdapter(
      Effect.gen(function* () {
        const adapter = yield* PaymentAdapter;
        return yield* adapter.getPurchaseHistory(true);
      }),
    );

    expect(transactions.map((transaction) => transaction.productId)).toEqual([
      "coins_forever",
      "active-sub",
    ]);
  });
});
