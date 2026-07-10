import { Context, type Effect } from "effect";

import type { Product, SubscriptionProduct } from "../entities/product";
import type { Transaction } from "../entities/transaction";
import type { RuntimeProductDefinition } from "../schema/runtime";
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

export class PaymentAdapter extends Context.Service<
  PaymentAdapter,
  {
    initConnection(
      onPurchase?: (transaction: Transaction) => void,
    ): Effect.Effect<void, FailedToInitializeNativeAdapterError>;

    endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never>;

    /**
     * Fetch products from the underlying native store. Receives the product
     * definitions exactly as the server returned them at SDK init time (keyed
     * by slug). Implementations resolve the platform-specific store productId
     * from the definition's `configuration.providers.*`.
     */
    getProducts(
      productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
    ): Effect.Effect<Product[], NativeAdapterNotInitializedError | FailedToGetProductsError, never>;

    buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
      product: TSubscriptionProduct,
      quantity?: number,
      appAccountToken?: string,
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
      transaction: Transaction,
    ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never>;

    getPurchaseHistory(
      onlyIncludeActiveItems?: boolean,
    ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never>;

    getPendingTransactions(): Effect.Effect<Transaction[], GetPendingTransactionsError, never>;

    // Platform specific methods
    presentCodeRedemptionSheet?(): Effect.Effect<
      void,
      FailedToPresentCodeRedemptionSheetError,
      never
    >;

    showManageSubscriptions?(): Effect.Effect<void, FailedToShowManageSubscriptionsError, never>;
  }
>()("rn-voidhash/PaymentAdapter") {}
