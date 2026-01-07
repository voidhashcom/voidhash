// Credits: A lot of this was inspired by https://github.com/hyochan/expo-iap
import type { HybridObject } from "react-native-nitro-modules";

export interface StorekitProductPurchaseOffer {
  id: string;
  type: number;
  paymentMode: string;
}

export interface StorekitTransaction extends HybridObject<{ ios: "swift" }> {
  readonly id: string;
  readonly ids: string[];
  readonly transactionId: string;
  readonly transactionDate: number;
  readonly transactionReceipt: string;
  readonly quantityIos: number;
  readonly originalTransactionDateIos: number;
  readonly originalTransactionIdentifierIos: string;
  readonly appAccountToken?: string | null;
  readonly appBundleIdIos: string;
  readonly productTypeIos: string;
  readonly subscriptionGroupIdIos?: string | null;
  readonly webOrderLineItemIdIos?: number | null;
  readonly expirationDateIos?: number | null;
  readonly isUpgradedIos?: boolean;
  readonly ownershipTypeIos: string;
  readonly revocationDateIos?: number | null;
  readonly revocationReasonIos?: string | null;
  readonly transactionReasonIos?: string | null;
  readonly jwsRepresentationIos?: string | null;
  readonly environmentIos?: string;
  readonly storefrontCountryCodeIos?: string;
  readonly reasonIos?: string;
  readonly offerIos?: StorekitProductPurchaseOffer | null;
  readonly priceIos?: number;
  readonly currencyIos?: string;
}
