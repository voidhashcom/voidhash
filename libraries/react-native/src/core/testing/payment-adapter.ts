import type { ProductNotFoundError } from "@voidhash/shared";
import { Effect, Layer } from "effect";

import { Product, type SubscriptionProduct } from "../entities/product";
import { Transaction } from "../entities/transaction";
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
  PurchasePendingError,
  UserCancelledError,
} from "../payment-adapters/errors";
import { PaymentAdapter } from "../payment-adapters/payment-adapter";
import type {
  ExtractSchemaProductDefinitions,
  VoidhashSchema,
} from "../schema";

export const TestPaymentAdapter = Layer.succeed(PaymentAdapter, {
  acknowledgePurchase(
    transaction: Transaction
  ): Effect.Effect<void, FailedToAcknowledgePurchaseError, never> {
    Effect.logDebug("TestPaymentAdapter: Acknowledging purchase", {
      transactionId: transaction.id,
    });
    return Effect.void;
  },

  buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
    product: TSubscriptionProduct,
    quantity = 1,
    _appAccountToken?: string
  ): Effect.Effect<
    Transaction,
    | UserCancelledError
    | PurchasePendingError
    | NativeAdapterNotInitializedError
    | ProductNotFoundError
    | FailedToBuyProductError,
    never
  > {
    Effect.logDebug("TestPaymentAdapter: Buying product", {
      productId: product.slug,
      quantity,
    });

    return Effect.succeed(
      new Transaction(
        "test-transaction-id",
        "test-transaction-id",
        product.slug,
        Date.now(),
        quantity,
        false,
        "ios",
        {}
      )
    );
  },

  endConnection(): Effect.Effect<void, FailedToEndNativeAdapterError, never> {
    Effect.logDebug("TestPaymentAdapter: Ending connection");
    return Effect.void;
  },

  getPendingTransactions(): Effect.Effect<
    Transaction[],
    GetPendingTransactionsError,
    never
  > {
    Effect.logDebug("TestPaymentAdapter: Getting pending transactions");
    return Effect.succeed([]);
  },

  getProducts<
    TSchema extends VoidhashSchema,
    TDefinedProducts extends ExtractSchemaProductDefinitions<TSchema>,
  >(
    productDefinitions: TDefinedProducts
  ): Effect.Effect<
    Product[],
    NativeAdapterNotInitializedError | FailedToGetProductsError,
    never
  > {
    const productDefinitionsArray = Object.values(
      productDefinitions
    ) as TDefinedProducts[keyof TDefinedProducts][];

    Effect.logDebug("TestPaymentAdapter: Getting products", {
      count: productDefinitionsArray.length,
    });

    return Effect.succeed(
      productDefinitionsArray.map(
        (productDefinition) =>
          new Product(
            productDefinition.slug,
            productDefinition.slug,
            productDefinition.properties.name,
            "Test product",
            productDefinition.slug,
            "100",
            100,
            "USD",
            "subscription",
            "ios"
          )
      )
    );
  },

  getPurchaseHistory(
    _onlyIncludeActiveItems = false
  ): Effect.Effect<Transaction[], GetPurchaseHistoryError, never> {
    Effect.logDebug("TestPaymentAdapter: Getting purchase history");
    return Effect.succeed([]);
  },

  initConnection(
    _onPurchase?: (transaction: Transaction) => void
  ): Effect.Effect<void, FailedToInitializeNativeAdapterError, never> {
    Effect.logDebug("TestPaymentAdapter: Initializing connection");
    return Effect.void;
  },

  presentCodeRedemptionSheet(): Effect.Effect<
    void,
    FailedToPresentCodeRedemptionSheetError,
    never
  > {
    Effect.logDebug("TestPaymentAdapter: Presenting code redemption sheet");
    return Effect.void;
  },

  showManageSubscriptions(): Effect.Effect<
    void,
    FailedToShowManageSubscriptionsError,
    never
  > {
    Effect.logDebug("TestPaymentAdapter: Showing manage subscriptions");
    return Effect.void;
  },
});
