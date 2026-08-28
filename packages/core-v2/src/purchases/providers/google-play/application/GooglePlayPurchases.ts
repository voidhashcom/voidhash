import { Context, type Effect } from "effect";

import { GooglePlayPaymentProviderServiceError } from "../domain/GooglePlayErrors.ts";

/** Canonical Google Play provider error exported with the service boundary. */
export { GooglePlayPaymentProviderServiceError };

/**
 * Result of an SDK-confirmed Google Play purchase. Only `personId` is needed —
 * `SdkService.submitPurchaseTransaction` re-fetches the snapshot after
 * processing. A `parked: true` result means the purchase was accepted but is
 * waiting for the product mapping to be created (a replay applies it later) —
 * an eventually-consistent success, not an error the client should see.
 */
export type GooglePlaySdkTransactionResult =
  | { readonly parked: false; readonly personId: string }
  | { readonly parked: true; readonly providerProductKey: string };

/**
 * Result returned to the RTDN webhook ingress. `accepted` reflects whether we
 * decoded the Pub/Sub envelope (i.e. whether Pub/Sub should stop retrying);
 * `handled` reflects whether we mutated purchase state beyond acknowledging
 * receipt.
 */
export interface GooglePlayAcceptRtdnNotificationResult {
  readonly accepted: true;
  readonly handled: boolean;
  readonly notificationType: string | undefined;
  readonly notificationUUID: string | undefined;
  readonly subtype: string | undefined;
}

export interface GooglePlayPaymentProviderServiceShape {
  /**
   * SDK entry point — the client submitted a freshly-purchased `purchaseToken`.
   * Fetches authoritative state from the Play Developer API and records the
   * purchase. `projectId` is passed explicitly (resolved by `SdkService` from
   * the project-elevated `AuthSession`) so this method's `R` channel is `never`.
   */
  readonly processSdkTransaction: (input: {
    readonly packageName: string;
    /** The Google Play product id resolved from the SDK product slug. */
    readonly productId: string;
    readonly purchaseToken: string;
    readonly distinctId: string;
    readonly projectId: string;
    readonly receivedAt: Date;
  }) => Effect.Effect<GooglePlaySdkTransactionResult, GooglePlayPaymentProviderServiceError, never>;
  /**
   * Webhook entry point — decodes a Google Pub/Sub RTDN push envelope,
   * re-fetches authoritative purchase state, and dispatches to the matching
   * `record*` method. Called from the Google Play RTDN endpoint.
   */
  readonly acceptRtdnNotification: (input: {
    readonly paymentProviderConfigurationId: string;
    readonly receivedAt: Date;
    /** The raw Pub/Sub push body (`{ message: { data: base64, ... } }`). */
    readonly pubsubBody: unknown;
  }) => Effect.Effect<
    GooglePlayAcceptRtdnNotificationResult,
    GooglePlayPaymentProviderServiceError,
    never
  >;
}

/**
 * Public service tag for the Google Play payment-provider boundary. The live
 * implementation is {@link GooglePlayPaymentProviderServiceLive} in
 * `googlePlay/payment-provider-service.ts`; the application root provides it.
 */
export class GooglePlayPaymentProviderService extends Context.Service<
  GooglePlayPaymentProviderService,
  GooglePlayPaymentProviderServiceShape
>()("@voidhash/core-v2/purchases/providers/GooglePlayPurchases") {}
