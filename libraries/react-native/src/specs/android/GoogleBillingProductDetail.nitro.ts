import type { HybridObject } from "react-native-nitro-modules";

import type { NitroNullable } from "../NitroNullable";
import type { GoogleBillingOneTimePurchaseOfferDetails } from "./GoogleBillingOneTimePurchaseOfferDetails.nitro";
import type { GoogleBillingSubscriptionOfferDetails } from "./GoogleBillingSubscriptionOfferDetails.nitro";

export interface GoogleBillingProductDetail extends HybridObject<{ android: "kotlin" }> {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: string;
  readonly displayName: string;
  readonly platform: string;
  readonly currency: string;
  readonly displayPrice: string;
  readonly subscriptionOfferDetails?: NitroNullable<GoogleBillingSubscriptionOfferDetails[]>;
  readonly oneTimePurchaseOfferDetails?: NitroNullable<GoogleBillingOneTimePurchaseOfferDetails>;
}
