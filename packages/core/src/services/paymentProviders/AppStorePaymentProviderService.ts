import { Context, type Effect, Schema } from "effect";

/**
 * Catch-all service error. Wraps unexpected failures from
 * `AppStorePaymentProviderService` at the public-method boundary so callers
 * see one stable error tag.
 */
export class AppStorePaymentProviderServiceError extends Schema.TaggedErrorClass<AppStorePaymentProviderServiceError>(
  "AppStorePaymentProviderServiceError",
)("AppStorePaymentProviderServiceError", { cause: Schema.String }) {}

/**
 * Result of an SDK-confirmed transaction. The new package only needs
 * `personId` (`SdkService.submitPurchaseTransaction` re-fetches the snapshot
 * after processing); richer downstream consumers continue to use the
 * `internal/` service directly.
 */
export interface AppStoreSdkTransactionResult {
  readonly personId: string;
}

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
  readonly notificationType: string | undefined;
  readonly notificationUUID: string | undefined;
  readonly subtype: string | undefined;
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

/**
 * Stub service tag for the App Store payment-provider boundary.
 *
 * The full implementation still lives in
 * `internal/packages/core/src/services/payment-providers/` because it depends
 * on the App Store reconcile / replay workflows and the App Store REST
 * client — both "difficult" migration pieces. The application root provides
 * a `Layer.effect` adapter that delegates to the `internal/` implementation.
 */
export class AppStorePaymentProviderService extends Context.Service<
  AppStorePaymentProviderService,
  AppStorePaymentProviderServiceShape
>()("AppStorePaymentProviderService") {}
