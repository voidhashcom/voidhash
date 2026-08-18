import { Effect, Layer } from "effect";
import { Alert, Platform } from "react-native";

import { Product, SubscriptionProduct } from "../entities/product";
import { Transaction } from "../entities/transaction";
import type { RuntimeProductDefinition } from "../schema/runtime";
import { FailedToBuyProductError, FailedToGetProductsError, UserCancelledError } from "./errors";
import { PaymentAdapter } from "./payment-adapter";

const transactionId = () => {
  const cryptoObject = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return cryptoObject?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const makeProduct = (definition: RuntimeProductDefinition): Product | null => {
  const configuration = definition.configuration.providers.development;
  if (!configuration) return null;
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
    return new SubscriptionProduct(...args, configuration.period, options);
  }
  return new Product(...args, options);
};

const buyProduct = (product: Product, quantity = 1) =>
  Effect.callback<Transaction, UserCancelledError | FailedToBuyProductError>((resume) => {
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
                      Date.now(),
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

export const DevelopmentPaymentAdapter = Layer.succeed(PaymentAdapter, {
  acknowledgePurchase: () => Effect.void,
  buyProduct,
  endConnection: () => Effect.void,
  getPendingTransactions: () => Effect.succeed([]),
  getProducts: (definitions) =>
    Effect.try({
      try: () => Object.values(definitions).flatMap((definition) => makeProduct(definition) ?? []),
      catch: (cause) =>
        new FailedToGetProductsError({ cause, message: "Failed to build development products" }),
    }),
  getPurchaseHistory: () => Effect.succeed([]),
  initConnection: () => Effect.void,
});
