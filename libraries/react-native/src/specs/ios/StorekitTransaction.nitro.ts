// Credits: A lot of this was inspired by https://github.com/hyochan/expo-iap
import type { HybridObject } from "react-native-nitro-modules";

import type { NitroNullable } from "../NitroNullable";

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
  readonly appAccountToken?: NitroNullable<string>;
  readonly appBundleIdIos: string;
  readonly productTypeIos: string;
  readonly subscriptionGroupIdIos?: NitroNullable<string>;
  readonly webOrderLineItemIdIos?: NitroNullable<number>;
  readonly expirationDateIos?: NitroNullable<number>;
  readonly isUpgradedIos?: boolean;
  readonly ownershipTypeIos: string;
  readonly revocationDateIos?: NitroNullable<number>;
  readonly revocationReasonIos?: NitroNullable<string>;
  readonly transactionReasonIos?: NitroNullable<string>;
  readonly jwsRepresentationIos?: NitroNullable<string>;
  readonly environmentIos?: string;
  readonly storefrontCountryCodeIos?: string;
  readonly reasonIos?: string;
  readonly offerIos?: NitroNullable<StorekitProductPurchaseOffer>;
  readonly priceIos?: number;
  readonly currencyIos?: string;
}
