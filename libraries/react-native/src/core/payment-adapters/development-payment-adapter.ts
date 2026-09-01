import * as R from "effect/Record";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { Alert, Platform } from "react-native";

import { Product, SubscriptionProduct } from "../entities/product";
import { Transaction } from "../entities/transaction";
import type { RuntimeProductDefinition } from "../schema/runtime";
import { FailedToBuyProductError, FailedToGetProductsError, UserCancelledError } from "./errors";
import { PaymentAdapter } from "./payment-adapter";

const transactionId = () => globalThis.crypto.randomUUID();

const makeProduct = (definition: RuntimeProductDefinition): Option.Option<Product> => {
  const configuration = definition.configuration.providers.development;
  if (!configuration) return Option.none();
  const args = [
    definition.id ?? definition.slug,
    definition.slug,
    definition.properties.name,
    "Development purchase",
    definition.properties.name,
    `$${configuration.price.toFixed(2)}`,
    configuration.price,
    configuration.currencyCode,
    definition.type,
    Platform.OS === "ios" ? "ios" : "android",
  ] as const;
  const options = { providerProductId: configuration.productId };
  if (definition.type === "subscription") {
    return Option.some(new SubscriptionProduct(...args, configuration.period, options));
  }
  return Option.some(new Product(...args, options));
};

const buyProduct = Effect.fn("DevelopmentPaymentAdapter.buyProduct")(function* (
  product: Product,
  quantity = 1,
) {
  const purchaseTimestamp = yield* Clock.currentTimeMillis;
  return yield* Effect.callback<Transaction, UserCancelledError | FailedToBuyProductError>((resume) => {
    let selected = false;
    const cancel = () => {
      if (selected) return;
      selected = true;
      resume(Effect.fail(new UserCancelledError({ message: "Development purchase cancelled" })));
    };
    let priceLabel = product.displayPrice;
    if (product instanceof SubscriptionProduct) {
      priceLabel = `${priceLabel} / ${product.interval}`;
    }
    Alert.alert(
      "Test purchase",
      `${product.displayName}\n${priceLabel}\n\nNothing will be charged.`,
      [
        { onPress: cancel, style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            if (selected) return;
            selected = true;
            const id = transactionId();
            setTimeout(
              () =>
                resume(
                  Effect.succeed(
                    new Transaction(
                      id,
                      id,
                      product.providerProductId ?? product.slug,
                      purchaseTimestamp,
                      quantity,
                      true,
                      product.platform,
                      { currency: product.currency, price: product.price, store: "development" },
                    ),
                  ),
                ),
              600,
            );
          },
          text: "Purchase",
        },
      ],
      { cancelable: true, onDismiss: cancel },
    );
  });
});

export const DevelopmentPaymentAdapter = Layer.succeed(PaymentAdapter, {
  acknowledgePurchase: () => Effect.void,
  buyProduct,
  endConnection: () => Effect.void,
  getPendingTransactions: () => Effect.succeed([]),
  getProducts: (definitions) =>
    Effect.try({
      try: () => R.values(definitions).flatMap((definition) => Option.toArray(makeProduct(definition))),
      catch: (cause) =>
        new FailedToGetProductsError({ cause, message: "Failed to build development products" }),
    }),
  getPurchaseHistory: () => Effect.succeed([]),
  initConnection: () => Effect.void,
});
