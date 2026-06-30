import type { HybridObject } from "react-native-nitro-modules";

export interface GoogleBillingPricingPhase extends HybridObject<{ android: "kotlin" }> {
  readonly formattedPrice: string;
  readonly priceCurrencyCode: string;
  readonly billingPeriod: string;
  readonly billingCycleCount: number;
  readonly priceAmountMicros: string;
  readonly recurrenceMode: number;
}

export interface GoogleBillingPricingPhases extends HybridObject<{ android: "kotlin" }> {
  readonly pricingPhaseList: GoogleBillingPricingPhase[];
}

export interface GoogleBillingSubscriptionOfferDetails extends HybridObject<{ android: "kotlin" }> {
  readonly basePlanId: string;
  readonly offerId?: string;
  readonly offerToken: string;
  readonly offerTags: string[];
  readonly pricingPhases: GoogleBillingPricingPhases;
}
