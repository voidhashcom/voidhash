import type { HybridObject } from "react-native-nitro-modules";

export interface GoogleBillingOneTimePurchaseOfferDetails extends HybridObject<{
  android: "kotlin";
}> {
  readonly priceCurrencyCode: string;
  readonly formattedPrice: string;
  readonly priceAmountMicros: string;
}
