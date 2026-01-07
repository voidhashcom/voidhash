import type { HybridObject } from "react-native-nitro-modules";

import type { StorekitProductOffer } from "./StorekitProductOffer.nitro";
import type { StorekitProductSubscriptionPeriod } from "./StorekitProductSubscriptionPeriod.nitro";

export interface StorekitProductSubscription extends HybridObject<{
  ios: "swift";
}> {
  readonly introductoryOffer?: StorekitProductOffer | null;
  readonly promotionalOffers: (StorekitProductOffer | null)[];
  readonly subscriptionGroupID: string;
  readonly subscriptionPeriod: StorekitProductSubscriptionPeriod;
}
