import * as R from "effect/Record";
/** we use it for Storekit that is only available on iOS */

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";

import { Storekit } from "../../nitro";
import type { StorekitProduct } from "../../specs/ios/StorekitProduct.nitro";
import type { StorekitTransaction } from "../../specs/ios/StorekitTransaction.nitro";
import { Product } from "../entities/product";
import { Transaction } from "../entities/transaction";
import type { RuntimeProductDefinition } from "../schema/runtime";
import {
  FailedToAcknowledgePurchaseError,
  FailedToBuyProductError,
  FailedToEndNativeAdapterError,
  FailedToGetProductsError,
  FailedToInitializeNativeAdapterError,
  FailedToPresentCodeRedemptionSheetError,
  FailedToShowManageSubscriptionsError,
  GetPendingTransactionsError,
  GetPurchaseHistoryError,
  NativeAdapterNotInitializedError,
  ProductNotFoundError,
  PurchasePendingError,
  UserCancelledError,
} from "./errors";
import { PaymentAdapter } from "./payment-adapter";

export const AppStoreAdapter = Layer.succeed(PaymentAdapter, {
  acknowledgePurchase(
    transaction: Transaction,
    _productType?: RuntimeProductDefinition["type"],
  ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never> {
    return Effect.fn("PaymentAdapter.acknowledgePurchase")(function* acknowledgePurchase() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new FailedToAcknowledgePurchaseError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      yield* Effect.tryPromise({
        catch: (error) => {
          if (P.isError(error) && error.message.startsWith("TRANSACTION_NOT_FOUND")) {
            return new FailedToAcknowledgePurchaseError({
              cause: "Transaction not found",
              message: "Failed to acknowledge purchase",
            });
          }
          return new FailedToAcknowledgePurchaseError({
            cause: error,
            message: "Failed to acknowledge purchase",
          });
        },
        try: () => storekit.finishTransaction(transaction.transactionId),
      });

      return yield* Effect.void;
    })();
  },

  buyProduct<TProduct extends Product>(
    product: TProduct,
    quantity = 1,
    appAccountToken?: string,
  ): Effect.Effect<
    Transaction,
    | UserCancelledError
    | PurchasePendingError
    | NativeAdapterNotInitializedError
    | ProductNotFoundError
    | FailedToBuyProductError,
    never
  > {
    return Effect.fn("PaymentAdapter.buyProduct")(function* buyProduct() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      const nativeTransaction = yield* Effect.tryPromise({
        catch: (error) => {
          if (P.isError(error)) {
            if (error.message.startsWith("USER_CANCELLED")) {
              return new UserCancelledError({
                message: "User cancelled",
              });
            }

            if (error.message.startsWith("PURCHASE_PENDING")) {
              return new PurchasePendingError({
                message: "Purchase pending",
              });
            }

            if (error.message.startsWith("STOREKIT_NOT_INITIALIZED")) {
              return new NativeAdapterNotInitializedError({
                message: "Native adapter not initialized",
              });
            }

            if (error.message.startsWith("PRODUCT_NOT_FOUND")) {
              return new ProductNotFoundError({
                message: "Product not found",
              });
            }
          }

          return new FailedToBuyProductError({
            cause: error,
            message: "Failed to buy product",
          });
        },
        try: () => storekit.buyProduct(product.id, appAccountToken || "", quantity),
      });

      return yield* Effect.succeed(mapStorekitTransactionToTransaction(nativeTransaction));
    })();
  },

  endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never> {
    return Effect.fn("PaymentAdapter.endConnection")(function* endConnection() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new FailedToEndNativeAdapterError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      const result = yield* Effect.tryPromise({
        catch: (error) =>
          new FailedToEndNativeAdapterError({
            cause: error,
            message: "Failed to end native adapter",
          }),
        try: () => storekit.endConnection(),
      });

      if (!result) {
        return yield* Effect.fail(
          new FailedToEndNativeAdapterError({
            message: "Failed to end native adapter",
          }),
        );
      }

      return yield* Effect.void;
    })();
  },

  getPendingTransactions(): Effect.Effect<Transaction[], GetPendingTransactionsError, never> {
    return Effect.fn("PaymentAdapter.getPendingTransactions")(function* getPendingTransactions() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new GetPendingTransactionsError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      const nativeTransactions = yield* Effect.try({
        catch: (error) =>
          new GetPendingTransactionsError({
            cause: error,
            message: "Failed to get pending transactions",
          }),
        try: () => storekit.getPendingTransactions(),
      });

      return yield* Effect.succeed(nativeTransactions.map(mapStorekitTransactionToTransaction));
    })();
  },

  getProducts(
    productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
  ): Effect.Effect<Product[], NativeAdapterNotInitializedError | FailedToGetProductsError, never> {
    return Effect.fn("PaymentAdapter.getProducts")(function* getProducts() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      const productDefinitionsArray = R.values(productDefinitions);

      const getProductId = (productDefinition: RuntimeProductDefinition) =>
        productDefinition.configuration.providers.appleAppStore?.productId;

      const productIds = productDefinitionsArray
        .map((productDefinition) => {
          const id = getProductId(productDefinition);
          if (!id) {
            return null;
          }
          return {
            id,
            slug: productDefinition.slug,
          };
        })
        .filter((slugIdPair): slugIdPair is { slug: string; id: string } => slugIdPair !== null);

      Effect.logDebug("Getting products from App Store", {
        productIds: productIds.map(({ id }) => id),
      });

      const nativeProducts = yield* Effect.tryPromise({
        catch: (error) => {
          if (P.isError(error) && error.message.startsWith("STOREKIT_NOT_INITIALIZED")) {
            Effect.logError("Failed to get products from App Store", {
              error,
            });
            return new NativeAdapterNotInitializedError({
              message: "Native adapter not initialized",
            });
          }

          Effect.logError("Failed to get products from App Store", {
            error,
          });

          return new FailedToGetProductsError({
            cause: error,
            message: "Failed to get products",
          });
        },
        try: () => storekit.getItems(productIds.map(({ id }) => id)),
      });

      Effect.logDebug("Got products from App Store", {
        nativeProducts,
      });

      return yield* Effect.succeed(
        nativeProducts
          .map((nativeProduct) => {
            const matched = productDefinitionsArray.find(
              (productDefinition) => getProductId(productDefinition) === nativeProduct.id,
            );
            if (!matched) {
              return null;
            }
            return mapStorekitProductToProduct(matched, nativeProduct);
          })
          .filter((p): p is Product => p !== null),
      );
    })();
  },

  getPurchaseHistory(
    onlyIncludeActiveItems = false,
  ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never> {
    return Effect.fn("PaymentAdapter.getPurchaseHistory")(function* getPurchaseHistory() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new GetPurchaseHistoryError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      const nativeTransactions = yield* Effect.tryPromise({
        catch: (error) =>
          new GetPurchaseHistoryError({
            cause: error,
            message: "Failed to get purchase history",
          }),
        try: () => storekit.getPurchasedItems(onlyIncludeActiveItems),
      });

      return yield* Effect.succeed(nativeTransactions.map(mapStorekitTransactionToTransaction));
    })();
  },

  initConnection(
    onPurchase?: (transaction: Transaction) => void,
  ): Effect.Effect<void, FailedToInitializeNativeAdapterError, never> {
    return Effect.fn("PaymentAdapter.initConnection")(function* initConnection() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new FailedToInitializeNativeAdapterError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      Effect.logDebug("Initializing App Store connection");
      const onTransaction = onPurchase
        ? (nativeTransaction: StorekitTransaction) => {
            const transaction = mapStorekitTransactionToTransaction(nativeTransaction);
            onPurchase(transaction);
          }
        : undefined;

      const connectionInitialized = yield* Effect.tryPromise({
        catch: (error) =>
          new FailedToInitializeNativeAdapterError({
            cause: error,
            message: "Failed to initialize native adapter",
          }),
        try: () => storekit.initConnection(onTransaction),
      });

      if (!connectionInitialized) {
        Effect.logError("Failed to initialize App Store connection");
        return yield* Effect.fail(
          new FailedToInitializeNativeAdapterError({
            message: "Failed to initialize native adapter",
          }),
        );
      }

      return yield* Effect.void;
    })();
  },

  presentCodeRedemptionSheet(): Effect.Effect<
    void,
    FailedToPresentCodeRedemptionSheetError,
    never
  > {
    return Effect.fn("PaymentAdapter.presentCodeRedemptionSheet")(
      function* presentCodeRedemptionSheet() {
        const storekit = Storekit;
        if (!storekit) {
          return yield* Effect.fail(
            new FailedToPresentCodeRedemptionSheetError({
              message: "StoreKit is not available on this platform",
            }),
          );
        }

        yield* Effect.try({
          catch: (error) =>
            new FailedToPresentCodeRedemptionSheetError({
              cause: error,
              message: "Failed to present code redemption sheet",
            }),
          try: () => storekit.presentCodeRedemptionSheet(),
        });

        return yield* Effect.void;
      },
    )();
  },

  showManageSubscriptions(): Effect.Effect<void, FailedToShowManageSubscriptionsError, never> {
    return Effect.fn("PaymentAdapter.showManageSubscriptions")(function* showManageSubscriptions() {
      const storekit = Storekit;
      if (!storekit) {
        return yield* Effect.fail(
          new FailedToShowManageSubscriptionsError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      yield* Effect.tryPromise({
        catch: (error) =>
          new FailedToShowManageSubscriptionsError({
            cause: error,
            message: "Failed to show manage subscriptions",
          }),
        try: () => storekit.showManageSubscriptions(),
      });

      return yield* Effect.void;
    })();
  },
});

// Helper functions for mapping StoreKit objects to our domain objects
function mapStorekitProductToProduct(
  productDefinition: RuntimeProductDefinition,
  nativeProduct: StorekitProduct,
): Product {
  return new Product(
    nativeProduct.id,
    productDefinition.slug,
    productDefinition.properties.name,
    nativeProduct.description,
    nativeProduct.displayName,
    nativeProduct.displayPrice,
    nativeProduct.price,
    nativeProduct.currency,
    nativeProduct.type,
    "ios",
  );
}

function mapStorekitTransactionToTransaction(nativeTransaction: StorekitTransaction): Transaction {
  return new Transaction(
    nativeTransaction.id,
    nativeTransaction.transactionId,
    nativeTransaction.id, // productId is the same as id for StoreKit
    nativeTransaction.transactionDate,
    nativeTransaction.quantityIos,
    false, // StoreKit doesn't have an acknowledged field, transactions are finished instead
    "ios",
    {
      currency: nativeTransaction.currencyIos,
      appAccountToken: nativeTransaction.appAccountToken ?? undefined,
      expirationDate: nativeTransaction.expirationDateIos ?? undefined,
      originalPurchaseDate: nativeTransaction.originalTransactionDateIos,
      originalTransactionId: nativeTransaction.originalTransactionIdentifierIos,
      price: nativeTransaction.priceIos,
      receipt: nativeTransaction.transactionReceipt,
    },
  );
}
