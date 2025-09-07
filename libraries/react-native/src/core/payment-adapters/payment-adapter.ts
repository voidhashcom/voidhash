import type { Result } from 'neverthrow';
import type { Product, SubscriptionProduct } from '../entities/product';
import type { Transaction } from '../entities/transaction';
import type { Logger } from '../logging';
import type { PlatformProvider } from '../platform/types';
import type {
  ExtractSchemaProductDefinitions,
  VoidhashSchema
} from '../schema';
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
} from './errors';

export interface PaymentAdapter {
  initConnection(
    onPurchase?: (transaction: Transaction) => void
  ): Promise<Result<void, FailedToInitializeNativeAdapterError>>;

  endConnection(): Promise<Result<void, FailedToEndNativeAdapterError>>;

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
  >;

  buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
    product: TSubscriptionProduct,
    quantity?: number,
    appAccountToken?: string
  ): Promise<
    Result<
      Transaction,
      | UserCancelledError
      | PurchasePendingError
      | NativeAdapterNotInitializedError
      | ProductNotFoundError
      | FailedToBuyProductError
    >
  >;

  acknowledgePurchase(
    transaction: Transaction
  ): Promise<Result<void, FailedToAcknowledgePurchaseError>>;

  getPurchaseHistory(
    onlyIncludeActiveItems?: boolean
  ): Promise<Result<Transaction[], GetPurchaseHistoryError>>;

  getPendingTransactions(): Promise<
    Result<Transaction[], GetPendingTransactionsError>
  >;

  // Platform specific methods
  presentCodeRedemptionSheet?(): Promise<
    Result<void, FailedToPresentCodeRedemptionSheetError>
  >;

  showManageSubscriptions?(): Promise<
    Result<void, FailedToShowManageSubscriptionsError>
  >;
}

export function createPaymentAdapter(
  platformProvider: PlatformProvider,
  logger: Logger
): PaymentAdapter {
  const platform = platformProvider.getPlatform();

  if (platform === 'ios') {
    const { AppStoreAdapter } = require('./app-store-adapter');
    return new AppStoreAdapter(logger);
  }

  if (platform === 'android') {
    const { GooglePlayAdapter } = require('./google-play-adapter');
    return new GooglePlayAdapter(logger);
  }

  throw new Error(`Unsupported platform: ${platform}`);
}
