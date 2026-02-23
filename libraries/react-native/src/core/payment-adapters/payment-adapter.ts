import { Context, type Effect } from "effect";

import type { Product, SubscriptionProduct } from "../entities/product";
import type { Transaction } from "../entities/transaction";
import type {
  ExtractSchemaProductDefinitions,
  VoidhashSchema,
} from "../schema";
import type {
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

export class PaymentAdapter extends Context.Tag("rn-voidhash/PaymentAdapter")<
  PaymentAdapter,
  {
    initConnection(
      onPurchase?: (transaction: Transaction) => void
    ): Effect.Effect<void, FailedToInitializeNativeAdapterError>;

    endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never>;

    getProducts<
      TSchema extends VoidhashSchema,
      TDefinedProducts extends ExtractSchemaProductDefinitions<TSchema>,
    >(
      productDefinitions: TDefinedProducts
    ): Effect.Effect<
      Product[],
      NativeAdapterNotInitializedError | FailedToGetProductsError,
      never
    >;

    buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
      product: TSubscriptionProduct,
      quantity?: number,
      appAccountToken?: string
    ): Effect.Effect<
      Transaction,
      | UserCancelledError
      | PurchasePendingError
      | NativeAdapterNotInitializedError
      | ProductNotFoundError
      | FailedToBuyProductError,
      never
    >;

    acknowledgePurchase(
      transaction: Transaction
    ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never>;

    getPurchaseHistory(
      onlyIncludeActiveItems?: boolean
    ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never>;

    getPendingTransactions(): Effect.Effect<
      Transaction[],
      GetPendingTransactionsError,
      never
    >;

    // Platform specific methods
    presentCodeRedemptionSheet?(): Effect.Effect<
      void,
      FailedToPresentCodeRedemptionSheetError,
      never
    >;

    showManageSubscriptions?(): Effect.Effect<
      void,
      FailedToShowManageSubscriptionsError,
      never
    >;
  }
>() {}

// export interface PaymentAdapter {
//   initConnection(
//     onPurchase?: (transaction: Transaction) => void
//   ): Effect.Effect<void, FailedToInitializeNativeAdapterError>;

//   endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never>;

//   getProducts<
//     TSchema extends VoidhashSchema,
//     TDefinedProducts extends ExtractSchemaProductDefinitions<TSchema>
//   >(
//     productDefinitions: TDefinedProducts
//   ): Effect.Effect<
//     Product[],
//     NativeAdapterNotInitializedError | FailedToGetProductsError,
//     never
//   >;

//   buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
//     product: TSubscriptionProduct,
//     quantity?: number,
//     appAccountToken?: string
//   ): Effect.Effect<
//     Transaction,
//     | UserCancelledError
//     | PurchasePendingError
//     | NativeAdapterNotInitializedError
//     | ProductNotFoundError
//     | FailedToBuyProductError,
//     never
//   >;

//   acknowledgePurchase(
//     transaction: Transaction
//   ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never>;

//   getPurchaseHistory(
//     onlyIncludeActiveItems?: boolean
//   ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never>;

//   getPendingTransactions(): Effect.Effect<
//     Transaction[],
//     GetPendingTransactionsError,
//     never
//   >;

//   // Platform specific methods
//   presentCodeRedemptionSheet?(): Effect.Effect<
//     void,
//     FailedToPresentCodeRedemptionSheetError,
//     never
//   >;

//   showManageSubscriptions?(): Effect.Effect<
//     void,
//     FailedToShowManageSubscriptionsError,
//     never
//   >;
// }

// export function createPaymentAdapter(
//   platformProvider: PlatformProvider,
//   logger: Logger
// ): PaymentAdapter {
//   const platform = platformProvider.getPlatform();

//   if (platform === 'ios') {
//     const { AppStoreAdapter } = require('./app-store-adapter');
//     return new AppStoreAdapter(logger);
//   }

//   if (platform === 'android') {
//     const { GooglePlayAdapter } = require('./google-play-adapter');
//     return new GooglePlayAdapter();
//   }

//   throw new Error(`Unsupported platform: ${platform}`);
// }
