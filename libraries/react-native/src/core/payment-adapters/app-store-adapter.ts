/** biome-ignore-all lint/style/noNonNullAssertion: we use it for Storekit that is only available on iOS */

import { Effect, Layer } from "effect";

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
    return Effect.gen(function* acknowledgePurchase() {
      if (!Storekit) {
        return yield* Effect.fail(
          new FailedToAcknowledgePurchaseError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      yield* Effect.tryPromise({
        catch: (error) => {
          if (error instanceof Error && error.message.startsWith("TRANSACTION_NOT_FOUND")) {
            return new FailedToAcknowledgePurchaseError({
              cause: new Error("Transaction not found"),
              message: "Failed to acknowledge purchase",
            });
          }
          return new FailedToAcknowledgePurchaseError({
            cause: error,
            message: "Failed to acknowledge purchase",
          });
        },
        try: () => Storekit!.finishTransaction(transaction.transactionId),
      });

      return yield* Effect.void;
    });
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
    return Effect.gen(function* buyProduct() {
      if (!Storekit) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      const nativeTransaction = yield* Effect.tryPromise({
        catch: (error) => {
          if (error instanceof Error) {
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
        try: () => Storekit!.buyProduct(product.id, appAccountToken || "", quantity),
      });

      return yield* Effect.succeed(mapStorekitTransactionToTransaction(nativeTransaction));
    });
  },

  endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never> {
    return Effect.gen(function* endConnection() {
      if (!Storekit) {
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
        try: () => Storekit!.endConnection(),
      });

      if (!result) {
        return yield* Effect.fail(
          new FailedToEndNativeAdapterError({
            message: "Failed to end native adapter",
          }),
        );
      }

      return yield* Effect.void;
    });
  },

  getPendingTransactions(): Effect.Effect<Transaction[], GetPendingTransactionsError, never> {
    return Effect.gen(function* getPendingTransactions() {
      if (!Storekit) {
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
        try: () => Storekit!.getPendingTransactions(),
      });

      return yield* Effect.succeed(nativeTransactions.map(mapStorekitTransactionToTransaction));
    });
  },

  getProducts(
    productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
  ): Effect.Effect<Product[], NativeAdapterNotInitializedError | FailedToGetProductsError, never> {
    return Effect.gen(function* getProducts() {
      if (!Storekit) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: "StoreKit is not available on this platform",
          }),
        );
      }

      const productDefinitionsArray = Object.values(productDefinitions);

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
          if (error instanceof Error && error.message.startsWith("STOREKIT_NOT_INITIALIZED")) {
            Effect.logError("Failed to get products from App Store", {
              error: error as Error,
            });
            return new NativeAdapterNotInitializedError({
              message: "Native adapter not initialized",
            });
          }

          Effect.logError("Failed to get products from App Store", {
            error: error as Error,
          });

          return new FailedToGetProductsError({
            cause: error,
            message: "Failed to get products",
          });
        },
        try: () => Storekit!.getItems(productIds.map(({ id }) => id)),
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
    });
  },

  getPurchaseHistory(
    onlyIncludeActiveItems = false,
  ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never> {
    return Effect.gen(function* getPurchaseHistory() {
      if (!Storekit) {
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
        try: () => Storekit!.getPurchasedItems(onlyIncludeActiveItems),
      });

      return yield* Effect.succeed(nativeTransactions.map(mapStorekitTransactionToTransaction));
    });
  },

  initConnection(
    onPurchase?: (transaction: Transaction) => void,
  ): Effect.Effect<void, FailedToInitializeNativeAdapterError, never> {
    return Effect.gen(function* initConnection() {
      if (!Storekit) {
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
        try: () => Storekit!.initConnection(onTransaction),
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
    });
  },

  presentCodeRedemptionSheet(): Effect.Effect<
    void,
    FailedToPresentCodeRedemptionSheetError,
    never
  > {
    return Effect.gen(function* presentCodeRedemptionSheet() {
      if (!Storekit) {
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
        try: () => Storekit!.presentCodeRedemptionSheet(),
      });

      return yield* Effect.void;
    });
  },

  showManageSubscriptions(): Effect.Effect<void, FailedToShowManageSubscriptionsError, never> {
    return Effect.gen(function* showManageSubscriptions() {
      if (!Storekit) {
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
        try: () => Storekit!.showManageSubscriptions(),
      });

      return yield* Effect.void;
    });
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
