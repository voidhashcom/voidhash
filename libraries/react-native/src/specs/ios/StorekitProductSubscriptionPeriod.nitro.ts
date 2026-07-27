import type { HybridObject } from "react-native-nitro-modules";

export type StorekitProductSubscriptionPeriodUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export interface StorekitProductSubscriptionPeriod extends HybridObject<{
  ios: "swift";
}> {
  readonly unit: StorekitProductSubscriptionPeriodUnit;
  readonly value: number;
}
