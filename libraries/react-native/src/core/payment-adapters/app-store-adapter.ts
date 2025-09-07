/** biome-ignore-all lint/style/noNonNullAssertion: we use it for Storekit that is only available on iOS */

import { err, ok, type Result } from 'neverthrow';
import {
  type ExtractSchemaProductDefinitions,
  ProductDefinition,
  type VoidhashSchema
} from '../..';
import { UnsupportedPlatformError } from '../../errors';
import { Storekit } from '../../nitro';
import type { StorekitProduct } from '../../specs/ios/StorekitProduct.nitro';
import type { StorekitTransaction } from '../../specs/ios/StorekitTransaction.nitro';
import { Product, type SubscriptionProduct } from '../entities/product';
import { Transaction } from '../entities/transaction';
import type { Logger } from '../logging';
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
import type { PaymentAdapter } from './payment-adapter';

export class AppStoreAdapter implements PaymentAdapter {
  private storekit: typeof Storekit;
  private logger: Logger;

  constructor(logger: Logger) {
    if (!Storekit) {
      throw new UnsupportedPlatformError(
        'StoreKit is not available on this platform'
      );
    }
    this.storekit = Storekit;
    this.logger = logger;
  }

  async initConnection(
    onPurchase?: (transaction: Transaction) => void
  ): Promise<Result<void, FailedToInitializeNativeAdapterError>> {
    try {
      this.logger.debug('Initializing App Store connection');
      const onTransaction = onPurchase
        ? (nativeTransaction: StorekitTransaction) => {
            const transaction =
              this.mapStorekitTransactionToTransaction(nativeTransaction);
            onPurchase(transaction);
          }
        : undefined;

      const connectionInitialized =
        await this.storekit!.initConnection(onTransaction);
      if (!connectionInitialized) {
        this.logger.error('Failed to initialize App Store connection');
        return err({
          code: 'FAILED_TO_INITIALIZE_NATIVE_ADAPTER',
          message: 'Failed to initialize native adapter'
        } satisfies FailedToInitializeNativeAdapterError);
      }
      return ok(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize App Store connection', {
        error: error as Error
      });
      return err({
        code: 'FAILED_TO_INITIALIZE_NATIVE_ADAPTER',
        message: 'Failed to initialize native adapter',
        cause: error as Error
      } satisfies FailedToInitializeNativeAdapterError);
    }
  }

  async endConnection(): Promise<Result<void, FailedToEndNativeAdapterError>> {
    try {
      const result = await this.storekit!.endConnection();
      if (!result) {
        return err({
          code: 'FAILED_TO_END_NATIVE_ADAPTER',
          message: 'Failed to end native adapter'
        } satisfies FailedToEndNativeAdapterError);
      }

      return ok(undefined);
    } catch (error) {
      return err({
        code: 'FAILED_TO_END_NATIVE_ADAPTER',
        message: 'Failed to end native adapter',
        cause: error as Error
      } satisfies FailedToEndNativeAdapterError);
    }
  }

  async getProducts<
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

    const getProductId = (
      productDefinition: TDefinedProducts[keyof TDefinedProducts]
    ) => {
      return productDefinition.configuration.providers.appleAppStore?.productId;
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

    try {
      this.logger.debug('Getting products from App Store', {
        productIds: productIds.map(({ id }) => id)
      });
      const nativeProducts = await this.storekit!.getItems(
        productIds.map(({ id }) => id)
      );
      this.logger.debug('Got products from App Store', {
        nativeProducts
      });
      return ok(
        nativeProducts.map((nativeProduct) =>
          this.mapStorekitProductToProduct(
            productDefinitionsArray.find(
              (productDefinition) =>
                getProductId(productDefinition) === nativeProduct.id
            ) as TDefinedProducts[keyof TDefinedProducts],
            nativeProduct
          )
        )
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('STOREKIT_NOT_INITIALIZED')
      ) {
        this.logger.error('Failed to get products from App Store', {
          error: error as Error
        });
        return err({
          code: 'NATIVE_ADAPTER_NOT_INITIALIZED',
          message: 'Native adapter not initialized'
        } satisfies NativeAdapterNotInitializedError);
      }

      this.logger.error('Failed to get products from App Store', {
        error: error as Error
      });

      return err({
        code: 'FAILED_TO_GET_PRODUCTS',
        message: 'Failed to get products',
        cause: error as Error
      } satisfies FailedToGetProductsError);
    }
  }

  async buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
    product: TSubscriptionProduct,
    quantity = 1,
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
  > {
    try {
      const nativeTransaction = await this.storekit!.buyProduct(
        product.id,
        appAccountToken || '',
        quantity
      );
      return ok(this.mapStorekitTransactionToTransaction(nativeTransaction));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('USER_CANCELLED')) {
          return err({
            code: 'USER_CANCELLED',
            message: 'User cancelled'
          } satisfies UserCancelledError);
        }

        if (error.message.startsWith('PURCHASE_PENDING')) {
          return err({
            code: 'PURCHASE_PENDING',
            message: 'Purchase pending'
          } satisfies PurchasePendingError);
        }

        if (error.message.startsWith('STOREKIT_NOT_INITIALIZED')) {
          return err({
            code: 'NATIVE_ADAPTER_NOT_INITIALIZED',
            message: 'Native adapter not initialized'
          } satisfies NativeAdapterNotInitializedError);
        }

        if (error.message.startsWith('PRODUCT_NOT_FOUND')) {
          return err({
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found'
          } satisfies ProductNotFoundError);
        }
      }

      return err({
        code: 'FAILED_TO_BUY_PRODUCT',
        message: 'Failed to buy product',
        cause: error as Error
      } satisfies FailedToBuyProductError);
    }
  }

  async acknowledgePurchase(
    transaction: Transaction
  ): Promise<Result<void, FailedToAcknowledgePurchaseError>> {
    try {
      await this.storekit!.finishTransaction(transaction.transactionId);
      return ok(undefined);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('TRANSACTION_NOT_FOUND')
      ) {
        return err({
          code: 'FAILED_TO_ACKNOWLEDGE_PURCHASE',
          message: 'Failed to acknowledge purchase',
          cause: new Error('Transaction not found')
        } satisfies FailedToAcknowledgePurchaseError);
      }
      return err({
        code: 'FAILED_TO_ACKNOWLEDGE_PURCHASE',
        message: 'Failed to acknowledge purchase',
        cause: error as Error
      } satisfies FailedToAcknowledgePurchaseError);
    }
  }

  async getPurchaseHistory(
    onlyIncludeActiveItems = false
  ): Promise<Result<Transaction[], GetPurchaseHistoryError>> {
    try {
      const nativeTransactions = await this.storekit!.getPurchasedItems(
        onlyIncludeActiveItems
      );
      return ok(
        nativeTransactions.map(this.mapStorekitTransactionToTransaction)
      );
    } catch (error) {
      return err({
        code: 'GET_PURCHASE_HISTORY_ERROR',
        message: 'Failed to get purchase history',
        cause: error as Error
      } satisfies GetPurchaseHistoryError);
    }
  }

  // biome-ignore lint/suspicious/useAwait: This function is async to satisfy the interface
  async getPendingTransactions(): Promise<
    Result<Transaction[], GetPendingTransactionsError>
  > {
    try {
      const nativeTransactions = this.storekit!.getPendingTransactions();
      return ok(
        nativeTransactions.map(this.mapStorekitTransactionToTransaction)
      );
    } catch (error) {
      return err({
        code: 'GET_PENDING_TRANSACTIONS_ERROR',
        message: 'Failed to get pending transactions',
        cause: error as Error
      } satisfies GetPendingTransactionsError);
    }
  }

  async presentCodeRedemptionSheet(): Promise<
    Result<void, FailedToPresentCodeRedemptionSheetError>
  > {
    try {
      await this.storekit!.presentCodeRedemptionSheet();
      return ok(undefined);
    } catch (error) {
      return err({
        code: 'FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET',
        message: 'Failed to present code redemption sheet',
        cause: error as Error
      } satisfies FailedToPresentCodeRedemptionSheetError);
    }
  }

  async showManageSubscriptions(): Promise<
    Result<void, FailedToShowManageSubscriptionsError>
  > {
    try {
      await this.storekit!.showManageSubscriptions();
      return ok(undefined);
    } catch (error) {
      return err({
        code: 'FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS',
        message: 'Failed to show manage subscriptions',
        cause: error as Error
      } satisfies FailedToShowManageSubscriptionsError);
    }
  }

  private mapStorekitProductToProduct<
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

  private mapStorekitTransactionToTransaction(
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
        originalTransactionId:
          nativeTransaction.originalTransactionIdentifierIos,
        originalPurchaseDate: nativeTransaction.originalTransactionDateIos,
        expirationDate: nativeTransaction.expirationDateIos ?? undefined,
        receipt: nativeTransaction.transactionReceipt,
        price: nativeTransaction.priceIos,
        currency: nativeTransaction.currencyIos
      }
    );
  }
}
