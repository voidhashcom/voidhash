import { Effect } from "effect";
import { vi } from "vitest";

import { UserCancelledError } from "../../src/core/payment-adapters/errors";
import { PaymentAdapter } from "../../src/core/payment-adapters/payment-adapter";
import { DevelopmentPaymentAdapter } from "../../src/core/payment-adapters/development-payment-adapter";
import { createTestSchema } from "../helpers/test-schema";
import { describe, expect, it } from "../helpers/effect-vitest";

const { alert } = vi.hoisted(() => ({ alert: vi.fn() }));

vi.mock("react-native", () => ({
  Alert: { alert },
  Platform: { OS: "ios" },
}));

const withAdapter = <A, E, R>(
  use: (adapter: typeof PaymentAdapter.Service) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    return yield* use(yield* PaymentAdapter);
  }).pipe(Effect.provide(DevelopmentPaymentAdapter));

describe("DevelopmentPaymentAdapter", () => {
  it("synthesizes products from server-computed development metadata", async () => {
    const schema = createTestSchema();
    const products = await Effect.runPromise(
      withAdapter((adapter) => adapter.getProducts(schema.products)),
    );

    expect(products).toHaveLength(3);
    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayPrice: "$9.99",
          id: "prod_monthly",
          interval: "month",
          price: 9.99,
          providerProductId: "monthly_sub",
          slug: "monthly_sub",
        }),
        expect.objectContaining({
          displayPrice: "$4.99",
          id: "prod_coins",
          providerProductId: "coins",
          slug: "coins",
        }),
      ]),
    );
  });

  it("returns a development transaction after confirmation", async () => {
    vi.useFakeTimers();
    // oxlint-disable-next-line effect/noTryCatch -- Fake timers must be restored even when an assertion rejects.
    try {
      const product = (
        await Effect.runPromise(
          withAdapter((adapter) => adapter.getProducts(createTestSchema().products)),
        )
      )[0]!;
      alert.mockImplementationOnce((_title, _message, buttons) => buttons[1].onPress());

      const purchase = Effect.runPromise(withAdapter((adapter) => adapter.buyProduct(product, 2)));
      await vi.advanceTimersByTimeAsync(600);
      const transaction = await purchase;

      expect(alert).toHaveBeenCalledWith(
        "Test purchase",
        expect.stringMatching(/\$9\.99 \/ month[\s\S]*Nothing will be charged\./),
        expect.any(Array),
        expect.objectContaining({ cancelable: true }),
      );
      expect(transaction).toMatchObject({
        isAcknowledged: true,
        productId: product.providerProductId,
        purchaseState: "purchased",
        quantity: 2,
        store: "development",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails with the native-compatible cancellation error", async () => {
    const product = (
      await Effect.runPromise(
        withAdapter((adapter) => adapter.getProducts(createTestSchema().products)),
      )
    )[0]!;
    alert.mockImplementationOnce((_title, _message, buttons) => buttons[0].onPress());

    await expect(
      Effect.runPromise(withAdapter((adapter) => adapter.buyProduct(product))),
    ).rejects.toBeInstanceOf(UserCancelledError);
  });
});
