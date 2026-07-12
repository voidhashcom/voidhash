/**
 * Coverage-intent placeholder for {@link AppStoreWebhookHandlerService}.
 *
 * Every public method on this service ultimately funnels through
 * `acceptServerNotification`, whose first real work — after the
 * configuration/project lookups — is:
 *
 *   1. `appStorePaymentProvider.buildSdkContextFromConfiguration(configuration)`,
 *      which decodes the stored `payment_provider_configurations.configuration`
 *      blob and **decrypts the per-tenant Apple PKCS8 `inAppPurchasePrivateKey`**
 *      before constructing a `SignedDataVerifier`; and
 *   2. `sdkContext.decodeNotification(input.signedPayload)`, which runs
 *      `SignedDataVerifier.verifyAndDecodeNotification` against Apple's real
 *      production/sandbox root CAs (`APPLE_ROOT_CERTIFICATES_PEM`) with
 *      `enableOnlineChecks: true` and `verifyNotificationOverride: Option.none()`
 *      hardcoded (see `sdk-context.ts`). The same applies to the nested
 *      `decodeSignedTransaction` / `decodeSignedRenewalInfo` calls.
 *
 * There is **no in-process seam** to substitute a test verifier: the verifier is
 * built deep inside `AppStorePaymentProvider.buildSdkContextFromConfiguration`
 * with the override permanently off. Exercising any branch therefore requires a
 * genuine **Apple-signed JWS** chained to Apple's CA — which we do not have, and
 * which the core test brief explicitly forbids faking ("needs an Apple-signed
 * JWS payload … DO NOT fake it — write test.todo(…)").
 *
 * Even the branches that look reachable without a valid payload are gated by the
 * same wall:
 *  - The `VerificationError` ack-without-handling branch still requires
 *    `buildSdkContextFromConfiguration` to succeed first, i.e. a real,
 *    decryptable Apple PKCS8 key in the configuration row.
 *  - The configuration-not-found / project-not-found branches run *before*
 *    `buildSdkContextFromConfiguration`, but standing up
 *    `AppStoreWebhookHandlerService.layer` to reach them still pulls in
 *    non-harness collaborators with their own external prerequisites
 *    (`AppStoreServerSdk` → `HttpClient`, `FxRateService` → FX-rate config,
 *    `PaymentConfigSecretCrypto` → a crypto key, plus `PurchaseProcessingService`
 *    and `PersonIdentityService`), none of which the
 *    `CoreIntegrationTestHarness` provides.
 *  - `replayParkedNotificationsForProductMapping` and
 *    `replayParkedNotificationsForSdkConfirmation` re-dispatch each parked row's
 *    stored `parkedRawPayload` back through `acceptServerNotification`, so they
 *    hit the identical verification wall.
 *
 * The cases below record the full intended coverage so it can be implemented
 * once a verification seam exists (e.g. plumbing `verifyNotificationOverride`
 * through the configuration / SDK-context build, or a recorded Apple-signed
 * sandbox notification fixture). Each `test.todo` states the persisted side
 * effect to assert: `payment_provider_notification_processed` rows
 * (`result`, `parkedRawPayload`, `parked_until_*`, `result_note`) plus the
 * downstream purchase-ledger / subscription / transaction state — and the exact
 * blocker.
 *
 * @see packages/core/src/services/paymentProviders/appStore/sdk-context.ts (hardcoded verifier config)
 * @see packages/core/src/services/paymentProviders/appStore/app-store-webhook-handler-service.ts
 */
import { describe, test } from "vitest";

describe("AppStoreWebhookHandlerService.acceptServerNotification", () => {
  test.todo(
    "configuration not found returns AppStorePaymentProviderConfigurationNotFoundError without writing a ledger row — reachable in principle (lookup precedes decode), but standing up AppStoreWebhookHandlerService.layer needs non-harness collaborators (AppStoreServerSdk→HttpClient, FxRateService, PaymentConfigSecretCrypto, PurchaseProcessingService, PersonIdentityService) the CoreIntegrationTestHarness does not provide",
  );

  test.todo(
    "project not found (configuration present, projects row missing) returns AppStorePaymentProviderProjectNotFoundError — same layer-wiring blocker as above; requires a payment_provider_configurations row whose projectId points at a deleted/absent project",
  );

  test.todo(
    "invalid signature (VerificationError from decodeNotification) acks without handling (accepted=true, handled=false) and writes NO notification-processed row — blocked: requires buildSdkContextFromConfiguration to succeed (real decryptable Apple PKCS8 key) AND a JWS that fails verification through the real Apple-CA verifier; no verifyNotificationOverride seam",
  );

  test.todo(
    "TEST notification with no signedTransactionInfo acks (accepted=true, handled=true) and writes payment_provider_notification_processed with result='ignored' — blocked: needs an Apple-signed TEST-type notification JWS that passes verifyAndDecodeNotification in-process",
  );

  test.todo(
    "non-TEST notification missing signedTransactionInfo writes a terminal-failure payment_provider_notification_processed row (result='failed', result_note mentions missing signedTransactionInfo) — blocked: needs a verified non-TEST notification JWS lacking signedTransactionInfo",
  );

  test.todo(
    "SUBSCRIBED routes to recordPurchase: asserts a purchase_ledger / subscription row and a notification-processed row with result='applied', source='webhook' — blocked: needs a verified SUBSCRIBED notification JWS + decodeSignedTransaction success",
  );

  test.todo(
    "DID_RENEW routes to recordSubscriptionRenewed: asserts the subscription period advances and notification-processed result='applied' — blocked: needs a verified DID_RENEW notification + signedTransactionInfo",
  );

  test.todo(
    "EXPIRED routes to recordSubscriptionExpired: asserts the subscription is marked expired and notification-processed result='applied' — blocked: needs a verified EXPIRED notification JWS",
  );

  test.todo(
    "DID_FAIL_TO_RENEW routes to recordBillingRetry: asserts billing-retry state (gracePeriodExpiresDate from signedRenewalInfo when present) and result='applied' — blocked: needs a verified DID_FAIL_TO_RENEW notification JWS",
  );

  test.todo(
    "REFUND routes to recordRefund: asserts the purchase is refunded and notification-processed result='applied' — blocked: needs a verified REFUND notification JWS",
  );

  test.todo(
    "REVOKE routes to recordEntitlementRevoked: asserts entitlement revocation and result='applied' — blocked: needs a verified REVOKE notification JWS",
  );

  test.todo(
    "DID_CHANGE_RENEWAL_STATUS / AUTO_RENEW_DISABLED routes to recordSubscriptionCanceled with cancelAtPeriodEnd=true: asserts subscription.cancelAtPeriodEnd and result='applied' — blocked: needs a verified DID_CHANGE_RENEWAL_STATUS notification JWS with that subtype",
  );

  test.todo(
    "DID_CHANGE_RENEWAL_STATUS / AUTO_RENEW_ENABLED routes to recordAutoRenewResumed: asserts cancel flags cleared and result='applied' — blocked: needs a verified notification JWS with subtype AUTO_RENEW_ENABLED",
  );

  test.todo(
    "product-not-mapped parks the notification: writes payment_provider_notification_processed with result='parked_pending_product_mapping', parked_raw_payload=signedPayload, parked_until_provider_product_key=productId, and acks(true) — blocked: needs a verified notification whose productId has no active payment_provider_configuration_products mapping",
  );

  test.todo(
    "terminal record failure (MissingPersonIdentifier / IdempotencyKeyDerivation / InvalidISO4217Currency) writes a notification-processed row with result='failed' and a descriptive result_note, acks(false) — blocked: needs a verified transaction JWS shaped to trigger one of TERMINAL_RECORD_FAILURE_TAGS",
  );

  test.todo(
    "trackNewPurchasesFromAppleServerNotifications=false with no prior SDK record parks: writes result='parked_pending_sdk_confirmation', parked_raw_payload=signedPayload, parked_until_original_transaction_id=originalTransactionId, acks(true), creates no purchase — blocked: needs a verified notification JWS plus a configuration with the tracking flag disabled",
  );

  test.todo(
    "isReplay=true bypasses the SDK-confirmation park gate (does not re-park even when no SDK record exists yet) — blocked: needs a verified notification JWS replayed with isReplay:true under a tracking-disabled configuration",
  );

  test.todo(
    "signedRenewalInfo decode failure is logged and processing continues with Option.none() (notification still applied) — blocked: needs a verified notification with a present-but-unverifiable signedRenewalInfo alongside a valid signedTransactionInfo",
  );

  test.todo(
    "wire-level dedup: the UNIQUE (configurationId, notificationUUID) on payment_provider_notification_processed makes a duplicate delivery a no-op insert that leaves the existing row's result untouched — blocked: needs two verified deliveries of the same notification JWS",
  );
});

describe("AppStoreWebhookHandlerService.replayParkedNotificationsForProductMapping", () => {
  test.todo(
    "fetches parked_pending_product_mapping rows for (configurationId, providerProductKey) and re-dispatches each via acceptServerNotification (isReplay:true) — blocked: re-dispatch runs the full decode/verify of each parked_raw_payload through the real Apple-CA verifier; no in-process seam",
  );

  test.todo(
    "marks resolved rows result='applied' and clears parked-state columns (parked_raw_payload, parked_until_provider_product_key, parked_until_original_transaction_id NULL) after a successful replay — blocked: replay path requires a verifiable stored parkedRawPayload",
  );

  test.todo(
    "returns appliedCount / failedCount / totalParked matching the parked rows processed — blocked: requires verifiable parked payloads to drive applied vs failed outcomes",
  );

  test.todo(
    "a parked row with a missing/non-string parked_raw_payload is marked result='failed' (result_note 'parked_raw_payload missing or not a string') without re-dispatch — PARTIALLY reachable: this branch never re-enters acceptServerNotification, but it still needs a real parked row seeded under a real configuration row and the service layer wired; revisit once layer wiring is solved",
  );
});

describe("AppStoreWebhookHandlerService.replayParkedNotificationsForSdkConfirmation", () => {
  test.todo(
    "orders parked rows by processedAt ASC to reproduce wire-arrival order, then re-dispatches each via acceptServerNotification (isReplay:true) — blocked: re-dispatch runs the real Apple-CA verifier on each parked_raw_payload; no in-process seam",
  );

  test.todo(
    "marks resolved rows result='applied' and clears parked-state columns after a successful SDK-confirmation replay — blocked: replay path requires verifiable stored parkedRawPayload",
  );

  test.todo(
    "returns appliedCount / failedCount / totalParked matching the parked rows processed — blocked: requires verifiable parked payloads to drive applied vs failed outcomes",
  );
});
