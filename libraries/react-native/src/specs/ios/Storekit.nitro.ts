// Credits: A lot of this was inspired by https://github.com/hyochan/expo-iap
import type { HybridObject } from 'react-native-nitro-modules';

import type { StorekitProduct } from './StorekitProduct.nitro';
import type { StorekitTransaction } from './StorekitTransaction.nitro';

export interface Storekit extends HybridObject<{ ios: 'swift' }> {
  initConnection(
    onTransaction?: (transaction: StorekitTransaction) => void
  ): Promise<boolean>;
  endConnection(): Promise<boolean>;
  getPurchasedItems(
    onlyIncludeActiveItems: boolean
  ): Promise<StorekitTransaction[]>;
  getItems(skus: string[]): Promise<StorekitProduct[]>;
  buyProduct(
    sku: string,
    appAccountToken: string,
    quantity: number
    // offer?: Record<string, string>
  ): Promise<StorekitTransaction>;
  finishTransaction(transactionId: string): Promise<void>;
  getPendingTransactions(): StorekitTransaction[];
  presentCodeRedemptionSheet(): void;
  showManageSubscriptions(): Promise<void>;
  // TODO: Implement these
  // beginRefundRequest(sku: string): Promise<string | null>;

  // TODO: Implement these
  // getAvailableItems(
  //   alsoPublishToEventListener?: boolean,
  //   onlyIncludeActiveItems?: boolean
  // ): Promise<StorekitProduct[]>;
  //   getStorefront(): Promise<string>;
  //   getAppTransaction(): Promise<Record<string, any> | null>;
  //   isEligibleForIntroOffer(groupID: string): Promise<boolean>;
  //   subscriptionStatus(sku: string): Promise<Record<string, any>[] | null>;
  //   currentEntitlement(sku: string): Promise<Record<string, any> | null>;
  //   latestTransaction(sku: string): Promise<Record<string, any> | null>;
  //   getPendingTransactions(): Promise<Record<string, any>[]>;
  //   sync(): Promise<boolean>;
  //   presentCodeRedemptionSheet(): Promise<boolean>;
  //   showManageSubscriptions(): Promise<boolean>;
  //   clearTransaction(): Promise<void>;
  //   beginRefundRequest(sku: string): Promise<string | null>;
  //   disable(): Promise<boolean>;
  //   getReceiptData(): Promise<string | null>;
  //   isTransactionVerified(sku: string): Promise<boolean>;
  //   getTransactionJws(sku: string): Promise<string | null>;
  //   validateReceiptIOS(sku: string): Promise<Record<string, any>>;
}
