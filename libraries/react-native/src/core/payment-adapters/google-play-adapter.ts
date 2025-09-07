/** biome-ignore-all lint/style/noNonNullAssertion: we use it for GoogleBilling that is only available on Android */

import { err, ok, type Result } from 'neverthrow';
import { UnsupportedPlatformError } from '../../errors';
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
import type {
  FailedToAcknowledgePurchaseError,
  FailedToBuyProductError,
  FailedToEndNativeAdapterError,
  FailedToGetProductsError,
  FailedToInitializeNativeAdapterError,
  GetPurchaseHistoryError,
  NativeAdapterNotInitializedError,
  ProductNotFoundError
} from './errors';
import type { PaymentAdapter } from './payment-adapter';

export class GooglePlayAdapter implements PaymentAdapter {
  private googleBilling: typeof GoogleBilling;

  constructor() {
    if (!GoogleBilling) {
      throw new UnsupportedPlatformError(
        'Google Billing is not available on this platform'
      );
    }
    this.googleBilling = GoogleBilling;
  }

  async initConnection(
    onPurchase?: (transaction: Transaction) => void
  ): Promise<Result<void, FailedToInitializeNativeAdapterError>> {
    try {
      const onPurchaseCallback = onPurchase
        ? (nativePurchase: GoogleBillingPurchase) => {
            const transaction =
              this.mapGoogleBillingPurchaseToTransaction(nativePurchase);
            onPurchase(transaction);
          }
        : undefined;

      const result =
        await this.googleBilling!.initConnection(onPurchaseCallback);

      if (!result) {
        return err({
          code: 'FAILED_TO_INITIALIZE_NATIVE_ADAPTER',
          message: 'Failed to initialize native adapter'
        } satisfies FailedToInitializeNativeAdapterError);
      }

      return ok(undefined);
    } catch (error) {
      return err({
        code: 'FAILED_TO_INITIALIZE_NATIVE_ADAPTER',
        message: 'Failed to initialize native adapter',
        cause: error as Error
      } satisfies FailedToInitializeNativeAdapterError);
    }
  }

  async endConnection(): Promise<Result<void, FailedToEndNativeAdapterError>> {
    try {
      const result = await this.googleBilling!.endConnection();
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
  ): Promise<Result<Product[], FailedToGetProductsError>> {
    try {
      const productIds = Object.values(productDefinitions).map((product) => {
        if (product instanceof ProductDefinition) {
          return {
            slug: product.slug,
            id: product.configuration.providers.googlePlay?.productId
          };
        }
        return null;
      });
      // Google Billing requires specifying the product type
      // We'll try both "inapp" and "subs" types and combine the results
      const inappProducts = await this.googleBilling!.getItemsByType(
        'inapp',
        productIds
          .map((pair) => pair?.id)
          .filter((id): id is string => id !== null)
      );
      const subsProducts = await this.googleBilling!.getItemsByType(
        'subs',
        productIds
          .map((pair) => pair?.id)
          .filter((id): id is string => id !== null)
      );

      const allProducts = [...inappProducts, ...subsProducts];
      return ok(
        allProducts.map((nativeProduct) =>
          this.mapGoogleBillingProductToProduct(
            productIds.find((pair) => pair?.id === nativeProduct.id)?.slug ??
              '',
            nativeProduct
          )
        )
      );
    } catch (error) {
      // Return empty array for empty skus to unify with App Store
      if (
        error instanceof Error &&
        error.message.startsWith('EMPTY_SKU_LIST')
      ) {
        return ok([]);
      }
      return err({
        code: 'FAILED_TO_GET_PRODUCTS',
        message: 'Failed to get products',
        cause: error as Error
      } satisfies FailedToGetProductsError);
    }
  }

  async buyProduct<TSubscriptionProduct extends SubscriptionProduct>(
    product: TSubscriptionProduct,
    _quantity = 1,
    appAccountToken?: string
  ): Promise<
    Result<
      Transaction,
      | NativeAdapterNotInitializedError
      | ProductNotFoundError
      | FailedToBuyProductError
    >
  > {
    try {
      // Determine product type based on the product's type field
      const productType: 'inapp' | 'subs' =
        product.type === 'subs' ? 'subs' : 'inapp';

      const nativePurchases = await this.googleBilling!.buyItemByType({
        type: productType,
        skuArr: [product.id],
        purchaseToken: undefined,
        replacementMode: undefined,
        obfuscatedAccountId: appAccountToken,
        obfuscatedProfileId: undefined,
        offerTokenArr: undefined,
        isOfferPersonalized: false
      });

      if (nativePurchases.length === 0) {
        throw new Error('No purchase returned from Google Billing');
      }

      return ok(this.mapGoogleBillingPurchaseToTransaction(nativePurchases[0]));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('GOOGLE_BILLING_NOT_INITIALIZED')) {
          return err({
            code: 'NATIVE_ADAPTER_NOT_INITIALIZED',
            message: 'Native adapter not initialized'
          } satisfies NativeAdapterNotInitializedError);
        }

        if (error.message.startsWith('SKU_NOT_FOUND')) {
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
      if (!transaction.purchaseToken) {
        return err({
          code: 'FAILED_TO_ACKNOWLEDGE_PURCHASE',
          message: 'Failed to acknowledge purchase',
          cause: new Error('Purchase token is required for acknowledgment')
        } satisfies FailedToAcknowledgePurchaseError);
      }

      const result = await this.googleBilling!.acknowledgePurchase(
        transaction.purchaseToken
      );
      if (result.responseCode !== 0) {
        return err({
          code: 'FAILED_TO_ACKNOWLEDGE_PURCHASE',
          message: 'Failed to acknowledge purchase',
          cause: new Error(result.message)
        } satisfies FailedToAcknowledgePurchaseError);
      }
      return ok(undefined);
    } catch (error) {
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
      const [inappPurchases, subsPurchases] = await Promise.all([
        this.googleBilling!.getAvailableItemsByType('inapp'),
        this.googleBilling!.getAvailableItemsByType('subs')
      ]);

      const allPurchases = [...inappPurchases, ...subsPurchases];
      const transactions = allPurchases.map(
        this.mapGoogleBillingPurchaseToTransaction
      );

      if (onlyIncludeActiveItems) {
        return ok(
          transactions.filter(
            // TODO: Check if this is the correct way to do this
            (t) => t.isAutoRenewing || t.productId.includes('inapp')
          )
        );
      }

      return ok(transactions);
    } catch (error) {
      return err({
        code: 'GET_PURCHASE_HISTORY_ERROR',
        message: 'Failed to get purchase history',
        cause: error as Error
      } satisfies GetPurchaseHistoryError);
    }
  }

  // biome-ignore lint/suspicious/useAwait: This function is not implemented
  async getPendingTransactions(): Promise<Result<Transaction[], never>> {
    // Google Billing doesn't have a direct equivalent to pending transactions
    // Pending transactions are typically handled through the purchase callback
    return ok([]);
  }

  private mapGoogleBillingProductToProduct(
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

  private mapGoogleBillingPurchaseToTransaction(
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
}
