import type { HybridObject } from 'react-native-nitro-modules';

export interface GoogleBillingPurchase
  extends HybridObject<{ android: 'kotlin' }> {
  readonly id: string;
  readonly ids: string[];
  readonly orderId?: string;
  readonly purchaseTime: number;
  readonly originalJson: string;
  readonly purchaseToken: string;
  readonly signature: string;
  readonly isAutoRenewing?: boolean;
  readonly isAcknowledged: boolean;
  readonly purchaseState: number;
  readonly packageName: string;
  readonly developerPayload: string;
  readonly obfuscatedAccountId?: string;
  readonly obfuscatedProfileId?: string;
}
