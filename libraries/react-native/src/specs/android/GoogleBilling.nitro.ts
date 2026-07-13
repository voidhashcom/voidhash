// Credits: A lot of this was inspired by https://github.com/hyochan/expo-iap
import type { HybridObject } from "react-native-nitro-modules";

import type { GoogleBillingAcknowledgeResult } from "./GoogleBillingAcknowledgeResult.nitro";
import type { GoogleBillingProductDetail } from "./GoogleBillingProductDetail.nitro";
import type { GoogleBillingPurchase } from "./GoogleBillingPurchase.nitro";

export type GoogleBillingProductType = "inapp" | "subs";

// export interface GoogleBillingConsumeResult {
//   readonly responseCode: number;
//   readonly debugMessage?: string;
//   readonly code: string;
//   readonly message: string;
//   readonly purchaseTokenAndroid?: string;
// }

export interface GoogleBillingBuyItemByTypeParams {
  readonly type: GoogleBillingProductType;
  readonly skuArr: string[];
  readonly purchaseToken?: string;
  readonly replacementMode?: number;
  readonly obfuscatedAccountId?: string;
  readonly obfuscatedProfileId?: string;
  readonly offerTokenArr?: string[];
  readonly isOfferPersonalized?: boolean;
}

export interface GoogleBilling extends HybridObject<{ android: "kotlin" }> {
  initConnection(onPurchase?: (purchase: GoogleBillingPurchase) => void): Promise<boolean>;
  endConnection(): Promise<boolean>;
  getItemsByType(
    type: GoogleBillingProductType,
    skus: string[],
  ): Promise<GoogleBillingProductDetail[]>;
  buyItemByType(params: GoogleBillingBuyItemByTypeParams): Promise<GoogleBillingPurchase[]>;
  acknowledgePurchase(token: string): Promise<GoogleBillingAcknowledgeResult>;
  consumeProduct(token: string): Promise<GoogleBillingAcknowledgeResult>;
  getAvailableItemsByType(type: GoogleBillingProductType): Promise<GoogleBillingPurchase[]>;

  // Get storefront/country code
  // getStorefront(): Promise<string>;
}
