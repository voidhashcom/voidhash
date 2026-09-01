import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Schema from "effect/Schema";

import { AppStorePaymentProviderServiceError } from "../domain/AppStoreErrors.ts";

/**
 * Result of an SDK-confirmed transaction. `SdkService` re-fetches the purchase
 * snapshot after processing, so only the resolved person identity crosses this
 * boundary. A `parked: true` result means the transaction was accepted but is
 * waiting for the product mapping to be created (a replay applies it later) —
 * an eventually-consistent success, not an error the client should see.
 */
export type AppStoreSdkTransactionResult =
  | { readonly parked: false; readonly personId: string }
  | { readonly parked: true; readonly providerProductKey: string };

/**
 * Result returned to the webhook ingress. `accepted` reflects whether we
 * verified Apple's signature and parsed the payload (i.e. whether Apple should
 * stop retrying); `handled` reflects whether we actually mutated purchase
 * state beyond acknowledging receipt. The `notificationType` / `subtype` /
 * `notificationUUID` fields are unwrapped from the decoded payload when
 * available (they may be absent if the payload is malformed).
 */
export interface AppStoreAcceptServerNotificationResult {
  readonly accepted: true;
  readonly handled: boolean;
  readonly notificationType: string | typeof Schema.Undefined.Type;
  readonly notificationUUID: string | typeof Schema.Undefined.Type;
  readonly subtype: string | typeof Schema.Undefined.Type;
}

export interface AppStorePaymentProviderServiceShape {
  readonly processSdkTransaction: (input: {
    readonly bundleId: string;
    readonly distinctId: string;
    /**
     * The project the SDK call is scoped to. Resolved by the caller
     * (`SdkService`) from the validated, project-elevated `AuthSession` and
     * passed in explicitly so this method carries no `AuthSession` requirement
     * (keeping its `R` channel `never`).
     */
    readonly projectId: string;
    readonly receivedAt: Date;
    readonly transactionId: string;
  }) => Effect.Effect<AppStoreSdkTransactionResult, AppStorePaymentProviderServiceError, never>;
  /**
   * Webhook entry point — verifies Apple's signature, decodes the signed
   * transaction, and dispatches the notification to the matching `record*`
   * method on the underlying provider. Routes call this from the Apple
   * server-to-server endpoint.
   */
  readonly acceptServerNotification: (input: {
    readonly paymentProviderConfigurationId: string;
    readonly receivedAt: Date;
    readonly signedPayload: string;
    /** Set when re-driving a parked/failed notification through the handler. */
    readonly isReplay?: boolean;
  }) => Effect.Effect<
    AppStoreAcceptServerNotificationResult,
    AppStorePaymentProviderServiceError,
    never
  >;
}

/** App Store purchase ingress boundary implemented by the backend provider adapter. */
export class AppStorePaymentProviderService extends Context.Service<
  AppStorePaymentProviderService,
  AppStorePaymentProviderServiceShape
>()("@voidhash/core-v2/purchases/providers/AppStorePurchases") {}
