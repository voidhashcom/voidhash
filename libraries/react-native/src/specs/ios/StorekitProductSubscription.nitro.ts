import type { HybridObject } from "react-native-nitro-modules";

import type { NitroNullable } from "../NitroNullable";
import type { StorekitProductOffer } from "./StorekitProductOffer.nitro";
import type { StorekitProductSubscriptionPeriod } from "./StorekitProductSubscriptionPeriod.nitro";

export interface StorekitProductSubscription extends HybridObject<{
  ios: "swift";
}> {
  readonly introductoryOffer?: NitroNullable<StorekitProductOffer>;
  readonly promotionalOffers: NitroNullable<StorekitProductOffer>[];
  readonly subscriptionGroupID: string;
  readonly subscriptionPeriod: StorekitProductSubscriptionPeriod;
}
