/** biome-ignore-all lint/style/noNonNullAssertion: we use it for GoogleBilling that is only available on Android */

import { ProductNotFoundError } from '@voidhash/shared/errors';
import { Effect, Layer } from 'effect';
import { GoogleBilling } from '../../nitro';
import type { GoogleBillingProductDetail } from '../../specs/android/GoogleBillingProductDetail.nitro';
import type { GoogleBillingPurchase } from '../../specs/android/GoogleBillingPurchase.nitro';
import { Product, type SubscriptionProduct } from '../entities/product';
import { Transaction } from '../entities/transaction';
import {
  type ExtractSchemaProductDefinitions,
  ProductDefinition,
  type VoidhashSchema
} from '../schema';
import {
  FailedToAcknowledgePurchaseError,
  FailedToBuyProductError,
  FailedToEndNativeAdapterError,
  FailedToGetProductsError,
  FailedToInitializeNativeAdapterError,
  type GetPendingTransactionsError,
  GetPurchaseHistoryError,
  NativeAdapterNotInitializedError,
  PurchasePendingError,
  UserCancelledError
} from './errors';
import { PaymentAdapter } from './payment-adapter';

export const GooglePlayAdapter = Layer.succeed(PaymentAdapter, {
  initConnection(
    onPurchase?: (transaction: Transaction) => void
  ): Effect.Effect<void, FailedToInitializeNativeAdapterError, never> {
    return Effect.gen(function* () {
      if (!GoogleBilling) {
        return yield* Effect.fail(
          new FailedToInitializeNativeAdapterError({
            message: 'Google Billing is not available on this platform'
          })
        );
      }

      const onPurchaseCallback = onPurchase
        ? (nativePurchase: GoogleBillingPurchase) => {
            const transaction =
              mapGoogleBillingPurchaseToTransaction(nativePurchase);
            onPurchase(transaction);
          }
        : undefined;

      yield* Effect.tryPromise({
        try: () => GoogleBilling!.initConnection(onPurchaseCallback),
        catch: (error) =>
          new FailedToInitializeNativeAdapterError({
            message: 'Failed to initialize native adapter',
            cause: error
          })
      });

      return yield* Effect.succeed(undefined);
    });
  },

  endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never> {
    return Effect.tryPromise({
      try: () => GoogleBilling!.endConnection(),
      catch: (error) =>
        new FailedToEndNativeAdapterError({
          message: 'Failed to end native adapter',
          cause: error
        })
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
      if (!GoogleBilling) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: 'Google Billing is not available on this platform'
          })
        );
      }

      const productIds = Object.values(productDefinitions).map((product) => {
        if (product instanceof ProductDefinition) {
          return {
            slug: product.slug,
            id: product.configuration.providers.googlePlay?.productId
          };
        }
        return null;
      });

      const inappProducts = yield* Effect.tryPromise({
        try: () =>
          GoogleBilling!.getItemsByType(
            'inapp',
            productIds
              .map((pair) => pair?.id)
              .filter((id): id is string => id !== null)
          ),
        catch: (error) =>
          new FailedToGetProductsError({
            message: 'Failed to get products',
            cause: error
          })
      });

      const subsProducts = yield* Effect.tryPromise({
        try: () =>
          GoogleBilling!.getItemsByType(
            'subs',
            productIds
              .map((pair) => pair?.id)
              .filter((id): id is string => id !== null)
          ),
        catch: (error) =>
          new FailedToGetProductsError({
            message: 'Failed to get products',
            cause: error
          })
      });

      const allProducts = [...inappProducts, ...subsProducts];
      return yield* Effect.succeed(
        allProducts.map((nativeProduct) =>
          mapGoogleBillingProductToProduct(
            productIds.find((pair) => pair?.id === nativeProduct.id)?.slug ??
              '',
            nativeProduct
          )
        )
      );
    });
  },

  buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
    product: TSubscriptionProduct,
    _quantity = 1,
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
      if (!GoogleBilling) {
        return yield* Effect.fail(
          new NativeAdapterNotInitializedError({
            message: 'Google Billing is not available on this platform'
          })
        );
      }

      Effect.logDebug('Attempting to buy product', { productId: product.id });

      // Determine product type based on the product's type field
      const productType: 'inapp' | 'subs' =
        product.type === 'subs' ? 'subs' : 'inapp';

      const nativePurchases = yield* Effect.tryPromise({
        try: () =>
          GoogleBilling!.buyItemByType({
            type: productType,
            skuArr: [product.id],
            purchaseToken: undefined,
            replacementMode: undefined,
            obfuscatedAccountId: appAccountToken,
            obfuscatedProfileId: undefined,
            offerTokenArr: undefined,
            isOfferPersonalized: false
          }),
        catch: (error) => {
          if (error instanceof Error) {
            if (error.message.startsWith('USER_CANCELLED')) {
              return new UserCancelledError({
                message: 'User cancelled the purchase'
              });
            }

            if (error.message.startsWith('PURCHASE_PENDING')) {
              return new PurchasePendingError({
                message: 'Purchase is pending'
              });
            }

            if (error.message.startsWith('GOOGLE_BILLING_NOT_INITIALIZED')) {
              return new NativeAdapterNotInitializedError({
                message: 'Native adapter not initialized'
              });
            }

            if (error.message.startsWith('SKU_NOT_FOUND')) {
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

      if (nativePurchases.length === 0) {
        return yield* Effect.fail(
          new FailedToBuyProductError({
            message: 'No purchase returned from Google Billing'
          })
        );
      }

      const transaction = mapGoogleBillingPurchaseToTransaction(
        nativePurchases[0]
      );
      Effect.logDebug('Purchase successful', {
        transactionId: transaction.id
      });

      return yield* Effect.succeed(transaction);
    });
  },

  acknowledgePurchase(
    transaction: Transaction
  ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never> {
    return Effect.gen(function* () {
      if (!GoogleBilling) {
        return yield* Effect.fail(
          new FailedToAcknowledgePurchaseError({
            message: 'Google Billing is not available on this platform'
          })
        );
      }

      Effect.logDebug('Attempting to acknowledge purchase', {
        transactionId: transaction.id
      });

      if (!transaction.purchaseToken) {
        return yield* Effect.fail(
          new FailedToAcknowledgePurchaseError({
            message: 'Purchase token is required for acknowledgment'
          })
        );
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          GoogleBilling!.acknowledgePurchase(transaction.purchaseToken!),
        catch: (error) =>
          new FailedToAcknowledgePurchaseError({
            message: 'Failed to acknowledge purchase',
            cause: error
          })
      });

      if (result.responseCode !== 0) {
        return yield* Effect.fail(
          new FailedToAcknowledgePurchaseError({
            message: 'Failed to acknowledge purchase',
            cause: new Error(result.message)
          })
        );
      }

      Effect.logDebug('Purchase acknowledged successfully', {
        transactionId: transaction.id
      });
      return yield* Effect.succeed(undefined);
    });
  },

  getPurchaseHistory(
    onlyIncludeActiveItems = false
  ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never> {
    return Effect.gen(function* () {
      if (!GoogleBilling) {
        return yield* Effect.fail(
          new GetPurchaseHistoryError({
            message: 'Google Billing is not available on this platform'
          })
        );
      }

      Effect.logDebug('Getting purchase history', { onlyIncludeActiveItems });

      const inappPurchases = yield* Effect.tryPromise({
        try: () => GoogleBilling!.getAvailableItemsByType('inapp'),
        catch: (error) =>
          new GetPurchaseHistoryError({
            message: 'Failed to get in-app purchase history',
            cause: error
          })
      });

      const subsPurchases = yield* Effect.tryPromise({
        try: () => GoogleBilling!.getAvailableItemsByType('subs'),
        catch: (error) =>
          new GetPurchaseHistoryError({
            message: 'Failed to get subscription purchase history',
            cause: error
          })
      });

      const allPurchases = [...inappPurchases, ...subsPurchases];
      const transactions = allPurchases.map((purchase) =>
        mapGoogleBillingPurchaseToTransaction(purchase)
      );

      if (onlyIncludeActiveItems) {
        const activeTransactions = transactions.filter(
          // TODO: Check if this is the correct way to do this
          (t) => t.isAutoRenewing || t.productId.includes('inapp')
        );
        Effect.logDebug('Filtered active transactions', {
          count: activeTransactions.length
        });
        return yield* Effect.succeed(activeTransactions);
      }

      Effect.logDebug('Retrieved all purchase history', {
        count: transactions.length
      });
      return yield* Effect.succeed(transactions);
    });
  },

  getPendingTransactions(): Effect.Effect<
    Transaction[],
    GetPendingTransactionsError,
    never
  > {
    // Google Billing doesn't have a direct equivalent to pending transactions
    // Pending transactions are typically handled through the purchase callback
    Effect.logDebug(
      'Getting pending transactions (Google Play returns empty array)'
    );
    return Effect.succeed([]);
  }
});

// Helper functions for mapping Google Billing objects to our domain objects
function mapGoogleBillingProductToProduct(
  slug: string,
  nativeProduct: GoogleBillingProductDetail
): Product {
  return new Product(
    nativeProduct.id,
    slug,
    nativeProduct.title,
    nativeProduct.description,
    nativeProduct.displayName,
    nativeProduct.displayPrice,
    Number.parseFloat(nativeProduct.displayPrice.replace(/[^0-9.]/g, '')), // Extract numeric price
    nativeProduct.currency,
    nativeProduct.type,
    'android'
  );
}

function mapGoogleBillingPurchaseToTransaction(
  nativePurchase: GoogleBillingPurchase
): Transaction {
  return new Transaction(
    nativePurchase.id,
    nativePurchase.orderId || nativePurchase.purchaseToken,
    nativePurchase.id, // productId is the same as id for Google Billing
    nativePurchase.purchaseTime,
    1, // Google Billing doesn't expose quantity in the same way
    nativePurchase.isAcknowledged,
    'android',
    {
      purchaseToken: nativePurchase.purchaseToken,
      receipt: nativePurchase.originalJson,
      isAutoRenewing: nativePurchase.isAutoRenewing
    }
  );
}

// export class GooglePlayAdapter implements PaymentAdapter {
//   private googleBilling: typeof GoogleBilling;

//   constructor() {
//     if (!GoogleBilling) {
//       throw new UnsupportedPlatformError(
//         'Google Billing is not available on this platform'
//       );
//     }
//     this.googleBilling = GoogleBilling;
//   }

//   initConnection(
//     onPurchase?: (transaction: Transaction) => void
//   ): Effect.Effect<void, FailedToInitializeNativeAdapterError, never> {
//     const self = this;
//     return Effect.gen(function* () {
//       const onPurchaseCallback = onPurchase
//         ? (nativePurchase: GoogleBillingPurchase) => {
//             const transaction =
//               self.mapGoogleBillingPurchaseToTransaction(nativePurchase);
//             onPurchase(transaction);
//           }
//         : undefined;

//       yield* Effect.tryPromise({
//         try: () => self.googleBilling!.initConnection(onPurchaseCallback),
//         catch: (error) =>
//           new FailedToInitializeNativeAdapterError({
//             message: 'Failed to initialize native adapter',
//             cause: error
//           })
//       });

//       return yield* Effect.succeed(undefined);
//     });
//   }

//   endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never> {
//     return Effect.tryPromise({
//       try: () => this.googleBilling!.endConnection(),
//       catch: (error) =>
//         new FailedToEndNativeAdapterError({
//           message: 'Failed to end native adapter',
//           cause: error
//         })
//     });
//   }

//   getProducts<
//     TSchema extends VoidhashSchema,
//     TDefinedProducts extends ExtractSchemaProductDefinitions<TSchema>
//   >(
//     productDefinitions: TDefinedProducts
//   ): Effect.Effect<
//     Product[],
//     NativeAdapterNotInitializedError | FailedToGetProductsError,
//     never
//   > {
//     const self = this;
//     return Effect.gen(function* () {
//       const productIds = Object.values(productDefinitions).map((product) => {
//         if (product instanceof ProductDefinition) {
//           return {
//             slug: product.slug,
//             id: product.configuration.providers.googlePlay?.productId
//           };
//         }
//         return null;
//       });

//       const inappProducts = yield* Effect.tryPromise({
//         try: () =>
//           self.googleBilling!.getItemsByType(
//             'inapp',
//             productIds
//               .map((pair) => pair?.id)
//               .filter((id): id is string => id !== null)
//           ),
//         catch: (error) =>
//           new FailedToGetProductsError({
//             message: 'Failed to get products',
//             cause: error
//           })
//       });

//       const subsProducts = yield* Effect.tryPromise({
//         try: () =>
//           self.googleBilling!.getItemsByType(
//             'subs',
//             productIds
//               .map((pair) => pair?.id)
//               .filter((id): id is string => id !== null)
//           ),
//         catch: (error) =>
//           new FailedToGetProductsError({
//             message: 'Failed to get products',
//             cause: error
//           })
//       });

//       const allProducts = [...inappProducts, ...subsProducts];
//       return yield* Effect.succeed(
//         allProducts.map((nativeProduct) =>
//           self.mapGoogleBillingProductToProduct(
//             productIds.find((pair) => pair?.id === nativeProduct.id)?.slug ??
//               '',
//             nativeProduct
//           )
//         )
//       );
//     });
//   }

//   buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
//     product: TSubscriptionProduct,
//     _quantity = 1,
//     appAccountToken?: string
//   ): Effect.Effect<
//     Transaction,
//     | UserCancelledError
//     | PurchasePendingError
//     | NativeAdapterNotInitializedError
//     | ProductNotFoundError
//     | FailedToBuyProductError,
//     never
//   > {
//     const self = this;
//     return Effect.gen(function* () {
//       Effect.logDebug('Attempting to buy product', { productId: product.id });

//       // Determine product type based on the product's type field
//       const productType: 'inapp' | 'subs' =
//         product.type === 'subs' ? 'subs' : 'inapp';

//       const nativePurchases = yield* Effect.tryPromise({
//         try: () =>
//           self.googleBilling!.buyItemByType({
//             type: productType,
//             skuArr: [product.id],
//             purchaseToken: undefined,
//             replacementMode: undefined,
//             obfuscatedAccountId: appAccountToken,
//             obfuscatedProfileId: undefined,
//             offerTokenArr: undefined,
//             isOfferPersonalized: false
//           }),
//         catch: (error) => {
//           if (error instanceof Error) {
//             if (error.message.startsWith('USER_CANCELLED')) {
//               return new UserCancelledError({
//                 message: 'User cancelled the purchase'
//               });
//             }

//             if (error.message.startsWith('PURCHASE_PENDING')) {
//               return new PurchasePendingError({
//                 message: 'Purchase is pending'
//               });
//             }

//             if (error.message.startsWith('GOOGLE_BILLING_NOT_INITIALIZED')) {
//               return new NativeAdapterNotInitializedError({
//                 message: 'Native adapter not initialized'
//               });
//             }

//             if (error.message.startsWith('SKU_NOT_FOUND')) {
//               return new ProductNotFoundError({
//                 message: 'Product not found'
//               });
//             }
//           }

//           return new FailedToBuyProductError({
//             message: 'Failed to buy product',
//             cause: error
//           });
//         }
//       });

//       if (nativePurchases.length === 0) {
//         return yield* Effect.fail(
//           new FailedToBuyProductError({
//             message: 'No purchase returned from Google Billing'
//           })
//         );
//       }

//       const transaction = self.mapGoogleBillingPurchaseToTransaction(
//         nativePurchases[0]
//       );
//       Effect.logDebug('Purchase successful', {
//         transactionId: transaction.id
//       });

//       return yield* Effect.succeed(transaction);
//     });
//   }

//   acknowledgePurchase(
//     transaction: Transaction
//   ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never> {
//     const self = this;
//     return Effect.gen(function* () {
//       Effect.logDebug('Attempting to acknowledge purchase', {
//         transactionId: transaction.id
//       });

//       if (!transaction.purchaseToken) {
//         return yield* Effect.fail(
//           new FailedToAcknowledgePurchaseError({
//             message: 'Purchase token is required for acknowledgment'
//           })
//         );
//       }

//       const result = yield* Effect.tryPromise({
//         try: () =>
//           self.googleBilling!.acknowledgePurchase(transaction.purchaseToken!),
//         catch: (error) =>
//           new FailedToAcknowledgePurchaseError({
//             message: 'Failed to acknowledge purchase',
//             cause: error
//           })
//       });

//       if (result.responseCode !== 0) {
//         return yield* Effect.fail(
//           new FailedToAcknowledgePurchaseError({
//             message: 'Failed to acknowledge purchase',
//             cause: new Error(result.message)
//           })
//         );
//       }

//       Effect.logDebug('Purchase acknowledged successfully', {
//         transactionId: transaction.id
//       });
//       return yield* Effect.succeed(undefined);
//     });
//   }

//   getPurchaseHistory(
//     onlyIncludeActiveItems = false
//   ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never> {
//     const self = this;
//     return Effect.gen(function* () {
//       Effect.logDebug('Getting purchase history', { onlyIncludeActiveItems });

//       const inappPurchases = yield* Effect.tryPromise({
//         try: () => self.googleBilling!.getAvailableItemsByType('inapp'),
//         catch: (error) =>
//           new GetPurchaseHistoryError({
//             message: 'Failed to get in-app purchase history',
//             cause: error
//           })
//       });

//       const subsPurchases = yield* Effect.tryPromise({
//         try: () => self.googleBilling!.getAvailableItemsByType('subs'),
//         catch: (error) =>
//           new GetPurchaseHistoryError({
//             message: 'Failed to get subscription purchase history',
//             cause: error
//           })
//       });

//       const allPurchases = [...inappPurchases, ...subsPurchases];
//       const transactions = allPurchases.map((purchase) =>
//         self.mapGoogleBillingPurchaseToTransaction(purchase)
//       );

//       if (onlyIncludeActiveItems) {
//         const activeTransactions = transactions.filter(
//           // TODO: Check if this is the correct way to do this
//           (t) => t.isAutoRenewing || t.productId.includes('inapp')
//         );
//         Effect.logDebug('Filtered active transactions', {
//           count: activeTransactions.length
//         });
//         return yield* Effect.succeed(activeTransactions);
//       }

//       Effect.logDebug('Retrieved all purchase history', {
//         count: transactions.length
//       });
//       return yield* Effect.succeed(transactions);
//     });
//   }

//   getPendingTransactions(): Effect.Effect<
//     Transaction[],
//     GetPendingTransactionsError,
//     never
//   > {
//     // Google Billing doesn't have a direct equivalent to pending transactions
//     // Pending transactions are typically handled through the purchase callback
//     Effect.logDebug(
//       'Getting pending transactions (Google Play returns empty array)'
//     );
//     return Effect.succeed([]);
//   }

//   private mapGoogleBillingProductToProduct(
//     slug: string,
//     nativeProduct: GoogleBillingProductDetail
//   ): Product {
//     return new Product(
//       nativeProduct.id,
//       slug,
//       nativeProduct.title,
//       nativeProduct.description,
//       nativeProduct.displayName,
//       nativeProduct.displayPrice,
//       Number.parseFloat(nativeProduct.displayPrice.replace(/[^0-9.]/g, '')), // Extract numeric price
//       nativeProduct.currency,
//       nativeProduct.type,
//       'android'
//     );
//   }

//   private mapGoogleBillingPurchaseToTransaction(
//     nativePurchase: GoogleBillingPurchase
//   ): Transaction {
//     return new Transaction(
//       nativePurchase.id,
//       nativePurchase.orderId || nativePurchase.purchaseToken,
//       nativePurchase.id, // productId is the same as id for Google Billing
//       nativePurchase.purchaseTime,
//       1, // Google Billing doesn't expose quantity in the same way
//       nativePurchase.isAcknowledged,
//       'android',
//       {
//         purchaseToken: nativePurchase.purchaseToken,
//         receipt: nativePurchase.originalJson,
//         isAutoRenewing: nativePurchase.isAutoRenewing
//       }
//     );
//   }
// }
