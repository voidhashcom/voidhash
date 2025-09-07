import { ok, type Result } from 'neverthrow';
import { Product, type SubscriptionProduct } from '../entities/product';
import { Transaction } from '../entities/transaction';
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
  UserCancelledError
} from '../payment-adapters/errors';
import type { PaymentAdapter } from '../payment-adapters/payment-adapter';
import type {
  ExtractSchemaProductDefinitions,
  VoidhashSchema
} from '../schema';

export class TestPaymentAdapter implements PaymentAdapter {
  initConnection(
    _?: (transaction: Transaction) => void
  ): Promise<Result<void, FailedToInitializeNativeAdapterError>> {
    return Promise.resolve(ok());
  }
  endConnection(): Promise<Result<void, FailedToEndNativeAdapterError>> {
    return Promise.resolve(ok());
  }
  getProducts<
    TSchema extends VoidhashSchema,
    TDefinedProducts extends ExtractSchemaProductDefinitions<TSchema>
  >(
    productDefinitions: TDefinedProducts
  ): Promise<
    Result<
      Product[],
      NativeAdapterNotInitializedError | FailedToGetProductsError
    >
  > {
    const productDefinitionsArray = Object.values(
      productDefinitions
    ) as TDefinedProducts[keyof TDefinedProducts][];

    return Promise.resolve(
      ok(
        productDefinitionsArray.map(
          (productDefinition) =>
            new Product(
              productDefinition.slug,
              productDefinition.slug,
              productDefinition.properties.name,
              'Test product',
              productDefinition.slug,
              '100',
              100,
              'USD',
              'subscription',
              'ios'
            )
        )
      )
    );
  }
  buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
    product: TSubscriptionProduct,
    quantity?: number,
    _?: string
  ): Promise<
    Result<
      Transaction,
      | UserCancelledError
      | PurchasePendingError
      | NativeAdapterNotInitializedError
      | ProductNotFoundError
      | FailedToBuyProductError
    >
  > {
    return Promise.resolve(
      ok(
        new Transaction(
          'test-transaction-id',
          'test-transaction-id',
          product.slug,
          Date.now(),
          quantity ?? 1,
          false,
          'ios',
          {}
        )
      )
    );
  }
  acknowledgePurchase(
    _: Transaction
  ): Promise<Result<void, FailedToAcknowledgePurchaseError>> {
    return Promise.resolve(ok());
  }
  getPurchaseHistory(
    _?: boolean
  ): Promise<Result<Transaction[], GetPurchaseHistoryError>> {
    return Promise.resolve(ok([]));
  }
  getPendingTransactions(): Promise<
    Result<Transaction[], GetPendingTransactionsError>
  > {
    return Promise.resolve(ok([]));
  }
  presentCodeRedemptionSheet?(): Promise<
    Result<void, FailedToPresentCodeRedemptionSheetError>
  > {
    return Promise.resolve(ok());
  }
  showManageSubscriptions?(): Promise<
    Result<void, FailedToShowManageSubscriptionsError>
  > {
    return Promise.resolve(ok());
  }
}
