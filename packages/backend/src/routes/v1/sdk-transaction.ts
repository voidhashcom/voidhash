import type { SdkSyncTransactionBody } from "@voidhash/api-contracts";
import { constant } from "@voidhash/lib/lang";

/** Maps the public SDK transaction payload to the provider-specific service input. */
export const mapSdkTransactionSubmission = (
  payload: SdkSyncTransactionBody,
  clientBundleId: string,
) =>
  payload.platform === "android"
    ? {
        packageName: clientBundleId,
        providerId: constant("google-play"),
        purchaseToken: payload.purchaseToken,
      }
    : {
        bundleId: clientBundleId,
        providerId: constant("apple-app-store"),
        transactionId: payload.transactionId,
      };
