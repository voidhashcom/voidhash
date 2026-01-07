import type { HybridObject } from "react-native-nitro-modules";

import type { StorekitProductSubscriptionPeriod } from "./StorekitProductSubscriptionPeriod.nitro";

export interface StorekitProductOffer extends HybridObject<{ ios: "swift" }> {
  readonly id?: string;
  readonly period: StorekitProductSubscriptionPeriod;
  readonly periodCount: number;
  readonly paymentMode: string;
  readonly type: string;
  readonly price: number;
  readonly displayPrice: string;
}
