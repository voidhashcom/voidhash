/** biome-ignore-all lint/style/noNonNullAssertion: we use it for Storekit that is only available on iOS */

import { ProductNotFoundError } from '@voidhash/shared';
import { Effect, Layer } from 'effect';
import {
  type ExtractSchemaProductDefinitions,
  ProductDefinition,
  type VoidhashSchema
} from '../..';
import { Storekit } from '../../nitro';
import type { StorekitProduct } from '../../specs/ios/StorekitProduct.nitro';
import type { StorekitTransaction } from '../../specs/ios/StorekitTransaction.nitro';
import { Product, type SubscriptionProduct } from '../entities/product';
import { Transaction } from '../entities/transaction';
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
  PurchasePendingError,
  UserCancelledError
} from './errors';
import { PaymentAdapter } from './payment-adapter';

export const AppStoreAdapter = Layer.succeed(PaymentAdapter, {
  initConnection(
    onPurchase?: (transaction: Transaction) => void
  ): Effect.Effect<void, FailedToInitializeNativeAdapterError, never> {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new FailedToInitializeNativeAdapterError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      Effect.logDebug('Initializing App Store connection');
      const onTransaction = onPurchase
        ? (nativeTransaction: StorekitTransaction) => {
            const transaction =
              mapStorekitTransactionToTransaction(nativeTransaction);
            onPurchase(transaction);
          }
        : undefined;

      const connectionInitialized = yield* Effect.tryPromise({
        try: () => Storekit!.initConnection(onTransaction),
        catch: (error) =>
          new FailedToInitializeNativeAdapterError({
            message: 'Failed to initialize native adapter',
            cause: error
          })
      });

      if (!connectionInitialized) {
        Effect.logError('Failed to initialize App Store connection');
        return yield* Effect.fail(
          new FailedToInitializeNativeAdapterError({
            message: 'Failed to initialize native adapter'
          })
        );
      }

      return yield* Effect.succeed(undefined);
    });
  },

  endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never> {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new FailedToEndNativeAdapterError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      const result = yield* Effect.tryPromise({
        try: () => Storekit!.endConnection(),
        catch: (error) =>
          new FailedToEndNativeAdapterError({
            message: 'Failed to end native adapter',
            cause: error
          })
      });

      if (!result) {
        return yield* Effect.fail(
          new FailedToEndNativeAdapterError({
            message: 'Failed to end native adapter'
          })
        );
      }

      return yield* Effect.succeed(undefined);
    });
  },

  getProducts<
    TSchema extends VoidhashSchema,
    TDefinedProducts extends ExtractSchemaProductDefinitions<TSchema>
  >(
    productDefinitions: TDefinedProducts
  ): Effect.Effect<
    Product[],
    NativeAdapterNotInitializedError | FailedToGetProductsError,
    never
  > {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      const productDefinitionsArray = Object.values(
        productDefinitions
      ) as TDefinedProducts[keyof TDefinedProducts][];

      const getProductId = (
        productDefinition: TDefinedProducts[keyof TDefinedProducts]
      ) => {
        return productDefinition.configuration.providers.appleAppStore
          ?.productId;
      };

      const productIds = productDefinitionsArray
        .map((productDefinition) => {
          if (productDefinition instanceof ProductDefinition) {
            return {
              slug: productDefinition.slug,
              id: getProductId(productDefinition)
            };
          }
          return null;
        })
        .filter(
          (slugIdPair): slugIdPair is { slug: string; id: string } =>
            slugIdPair !== null
        );

      Effect.logDebug('Getting products from App Store', {
        productIds: productIds.map(({ id }) => id)
      });

      const nativeProducts = yield* Effect.tryPromise({
        try: () => Storekit!.getItems(productIds.map(({ id }) => id)),
        catch: (error) => {
          if (
            error instanceof Error &&
            error.message.startsWith('STOREKIT_NOT_INITIALIZED')
          ) {
            Effect.logError('Failed to get products from App Store', {
              error: error as Error
            });
            return new NativeAdapterNotInitializedError({
              message: 'Native adapter not initialized'
            });
          }

          Effect.logError('Failed to get products from App Store', {
            error: error as Error
          });

          return new FailedToGetProductsError({
            message: 'Failed to get products',
            cause: error
          });
        }
      });

      Effect.logDebug('Got products from App Store', {
        nativeProducts
      });

      return yield* Effect.succeed(
        nativeProducts.map((nativeProduct) =>
          mapStorekitProductToProduct(
            productDefinitionsArray.find(
              (productDefinition) =>
                getProductId(productDefinition) === nativeProduct.id
            ) as TDefinedProducts[keyof TDefinedProducts],
            nativeProduct
          )
        )
      );
    });
  },

  buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
    product: TSubscriptionProduct,
    quantity = 1,
    appAccountToken?: string
  ): Effect.Effect<
    Transaction,
    | UserCancelledError
    | PurchasePendingError
    | NativeAdapterNotInitializedError
    | ProductNotFoundError
    | FailedToBuyProductError,
    never
  > {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      const nativeTransaction = yield* Effect.tryPromise({
        try: () =>
          Storekit!.buyProduct(product.id, appAccountToken || '', quantity),
        catch: (error) => {
          if (error instanceof Error) {
            if (error.message.startsWith('USER_CANCELLED')) {
              return new UserCancelledError({
                message: 'User cancelled'
              });
            }

            if (error.message.startsWith('PURCHASE_PENDING')) {
              return new PurchasePendingError({
                message: 'Purchase pending'
              });
            }

            if (error.message.startsWith('STOREKIT_NOT_INITIALIZED')) {
              return new NativeAdapterNotInitializedError({
                message: 'Native adapter not initialized'
              });
            }

            if (error.message.startsWith('PRODUCT_NOT_FOUND')) {
              return new ProductNotFoundError({
                message: 'Product not found'
              });
            }
          }

          return new FailedToBuyProductError({
            message: 'Failed to buy product',
            cause: error
          });
        }
      });

      return yield* Effect.succeed(
        mapStorekitTransactionToTransaction(nativeTransaction)
      );
    });
  },

  acknowledgePurchase(
    transaction: Transaction
  ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never> {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new FailedToAcknowledgePurchaseError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      yield* Effect.tryPromise({
        try: () => Storekit!.finishTransaction(transaction.transactionId),
        catch: (error) => {
          if (
            error instanceof Error &&
            error.message.startsWith('TRANSACTION_NOT_FOUND')
          ) {
            return new FailedToAcknowledgePurchaseError({
              message: 'Failed to acknowledge purchase',
              cause: new Error('Transaction not found')
            });
          }
          return new FailedToAcknowledgePurchaseError({
            message: 'Failed to acknowledge purchase',
            cause: error
          });
        }
      });

      return yield* Effect.succeed(undefined);
    });
  },

  getPurchaseHistory(
    onlyIncludeActiveItems = false
  ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never> {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new GetPurchaseHistoryError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      const nativeTransactions = yield* Effect.tryPromise({
        try: () => Storekit!.getPurchasedItems(onlyIncludeActiveItems),
        catch: (error) =>
          new GetPurchaseHistoryError({
            message: 'Failed to get purchase history',
            cause: error
          })
      });

      return yield* Effect.succeed(
        nativeTransactions.map(mapStorekitTransactionToTransaction)
      );
    });
  },

  getPendingTransactions(): Effect.Effect<
    Transaction[],
    GetPendingTransactionsError,
    never
  > {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new GetPendingTransactionsError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      const nativeTransactions = yield* Effect.try({
        try: () => Storekit!.getPendingTransactions(),
        catch: (error) =>
          new GetPendingTransactionsError({
            message: 'Failed to get pending transactions',
            cause: error
          })
      });

      return yield* Effect.succeed(
        nativeTransactions.map(mapStorekitTransactionToTransaction)
      );
    });
  },

  presentCodeRedemptionSheet(): Effect.Effect<
    void,
    FailedToPresentCodeRedemptionSheetError,
    never
  > {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new FailedToPresentCodeRedemptionSheetError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      yield* Effect.try({
        try: () => Storekit!.presentCodeRedemptionSheet(),
        catch: (error) =>
          new FailedToPresentCodeRedemptionSheetError({
            message: 'Failed to present code redemption sheet',
            cause: error
          })
      });

      return yield* Effect.succeed(undefined);
    });
  },

  showManageSubscriptions(): Effect.Effect<
    void,
    FailedToShowManageSubscriptionsError,
    never
  > {
    return Effect.gen(function* () {
      if (!Storekit) {
        return yield* Effect.fail(
          new FailedToShowManageSubscriptionsError({
            message: 'StoreKit is not available on this platform'
          })
        );
      }

      yield* Effect.tryPromise({
        try: () => Storekit!.showManageSubscriptions(),
        catch: (error) =>
          new FailedToShowManageSubscriptionsError({
            message: 'Failed to show manage subscriptions',
            cause: error
          })
      });

      return yield* Effect.succeed(undefined);
    });
  }
});

// Helper functions for mapping StoreKit objects to our domain objects
function mapStorekitProductToProduct<
  TSchema extends VoidhashSchema,
  TDefinedProducts extends ExtractSchemaProductDefinitions<TSchema>
>(
  productDefinition: TDefinedProducts[keyof TDefinedProducts],
  nativeProduct: StorekitProduct
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
    'ios'
  );
}

function mapStorekitTransactionToTransaction(
  nativeTransaction: StorekitTransaction
): Transaction {
  return new Transaction(
    nativeTransaction.id,
    nativeTransaction.transactionId,
    nativeTransaction.id, // productId is the same as id for StoreKit
    nativeTransaction.transactionDate,
    nativeTransaction.quantityIos,
    false, // StoreKit doesn't have an acknowledged field, transactions are finished instead
    'ios',
    {
      originalTransactionId: nativeTransaction.originalTransactionIdentifierIos,
      originalPurchaseDate: nativeTransaction.originalTransactionDateIos,
      expirationDate: nativeTransaction.expirationDateIos ?? undefined,
      receipt: nativeTransaction.transactionReceipt,
      price: nativeTransaction.priceIos,
      currency: nativeTransaction.currencyIos
    }
  );
}
