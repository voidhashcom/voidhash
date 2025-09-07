import type { HybridObject } from 'react-native-nitro-modules';

type PurchasedItemType = 'subscription' | 'inapp';

export interface PurchasedItem
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  type: PurchasedItemType;
  sku: string;
}
