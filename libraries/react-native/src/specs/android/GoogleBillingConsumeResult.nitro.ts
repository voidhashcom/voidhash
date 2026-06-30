import type { HybridObject } from "react-native-nitro-modules";

export interface GoogleBillingConsumeResult extends HybridObject<{ android: "kotlin" }> {
  readonly responseCode: number;
  readonly debugMessage?: string;
  readonly code: string;
  readonly message: string;
  readonly purchaseTokenAndroid?: string;
}
