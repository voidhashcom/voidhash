import {
  AppStoreServerSdk,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
} from "@voidhash/app-store-server-sdk";
import {
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type PersonOriginValue,
  type Project as DbProject,
  type ProviderEnvironmentValue,
  PersonOrigin,
} from "@voidhash/db";
import { generateId } from "@voidhash/core/utils";
import { PurchaseType } from "@voidhash/lib/constants";
import { constant, pick } from "@voidhash/lib/lang";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";

import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import type { PurchaseProcessingResult } from "@voidhash/core-v2";
import {
  DEFAULT_SUBSCRIPTION_TRANSFER_MODE,
  type SubscriptionTransferMode,
} from "@voidhash/core-v2";
import {
  FxRates as FxRateService,
  type PurchaseActionContext,
  PurchaseProcessor,
} from "@voidhash/core-v2";
import {
  ACCOUNT_TOKEN_SERVICE_ID,
  deriveAccountToken,
} from "@voidhash/core/utils/crypto/account-token";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import type { PaymentProvider } from "../PaymentProviderAdapter.ts";
import {
  type AppStoreGlobalConfiguration,
  type AppStoreProductConfiguration,
  type AppStoreStoredGlobalConfiguration,
  globalConfiguration as globalConfigurationSchema,
  makeAppStoreConfigProvider,
  productConfiguration as productConfigurationSchema,
} from "./config-provider.ts";
import {
  AppStorePaymentProviderProductNotMappedError,
  AppStorePaymentProviderSdkTransactionMissingDistinctIdError,
  AppStorePaymentProviderServiceError,
  AppStorePaymentProviderTransactionMissingPersonIdentifierError,
} from "./errors.ts";
import {
  type AppStorePurchaseProcessingEventType,
  buildAppStoreWebhookAnonymousDistinctId,
  getAppStorePersonIdentifier,
  getAppStorePurchaseProcessingIdempotencyKey,
  getAppStoreProviderSubscriptionId,
  getAppStoreProviderTransactionId,
  makeIgnoredPurchaseProcessingResult,
} from "./helpers.ts";
import { buildAppStoreMoney } from "./money.ts";
import { AppStorePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import {
  buildAppStoreSdkContext,
  type AppStoreServerApiClientFactory,
  type AppStoreSdkContext,
  type AppStoreSignedDataVerifierFactory,
} from "./sdk-context.ts";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";

/** Optional verifier-only environment override for hermetic runtime composition. */
export const AppStoreVerifierEnvironmentOverride = Context.Reference<
  import("./sdk-context.ts").AppStoreEnvironment | typeof Schema.Undefined.Type
>("@voidhash/backend/purchases/AppStoreVerifierEnvironmentOverride", {
  defaultValue: () => undefined,
});

/** Optional signed-data verifier factory override for runtime composition. */
export const AppStoreSignedDataVerifierFactoryOverride = Context.Reference<
  AppStoreSignedDataVerifierFactory | typeof Schema.Undefined.Type
>("@voidhash/backend/purchases/AppStoreSignedDataVerifierFactoryOverride", {
  defaultValue: () => undefined,
});

/** Optional App Store Server API client factory override for runtime composition. */
export const AppStoreServerApiClientFactoryOverride = Context.Reference<
  AppStoreServerApiClientFactory | typeof Schema.Undefined.Type
>("@voidhash/backend/purchases/AppStoreServerApiClientFactoryOverride", {
  defaultValue: () => undefined,
});

/**
 * TTL for `parked_pending_sdk_confirmation` notification rows. Aged past this
 * point by `AppStoreExpireParkedSdkNotificationsWorkflow`. Kept generous (90
 * days) because parked rows for legitimate SDK-confirmable purchases tend to
 * resolve in seconds-to-hours, so reaching this threshold reliably indicates
 * a series the SDK will never confirm (uninstalled app, RevenueCat-only
 * subscriber, etc.).
 */
export const APP_STORE_PARKED_SDK_TTL_DAYS = 90;

// The configuration schema, derived types, and config-write provider live in
// `./config-provider.ts` (the lightweight admin/config surface). They are
// re-exported here so existing importers of `globalConfigurationSchema` from
// this module keep working.
export { globalConfigurationSchema, productConfigurationSchema };

export interface AppStorePaymentProviderShape extends PaymentProvider<
  "apple-app-store",
  AppStoreStoredGlobalConfiguration,
  AppStoreProductConfiguration
> {
  readonly globalConfigurationSchema: typeof globalConfigurationSchema;
  readonly productConfigurationSchema: typeof productConfigurationSchema;
}

/**
 * Shared base accepted by every `record*` method. The webhook handler and the
 * SDK boundary both pre-resolve `configuration` and `project` and pass them in
 * — re-fetching here would be wasteful and racy across config rotation.
 *
 * `decodedRenewalInfo` is `Option.none()` when the inbound payload didn't
 * include signed renewal info (one-time charges, SDK confirmations, older
 * reconciliation paths). Callers that have access to it (the webhook handler
 * after decoding `signedRenewalInfo`) pass `Option.some(...)` so downstream
 * record methods can populate fields that live only on renewal info
 * (`gracePeriodExpiresDate`, `priceIncrease` effective date, etc.).
 */
type RecordTransactionInputBase = {
  readonly configuration: DbPaymentProviderConfiguration;
  readonly project: DbProject;
  readonly decodedTransaction: JWSTransactionDecodedPayload;
  readonly decodedRenewalInfo: Option.Option<JWSRenewalInfoDecodedPayload>;
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly receivedAt: Date;
  readonly notificationUUID?: string;
  readonly subtype?: string;
};

/**
 * The SDK path requires a `distinctId` so we can attach the purchase to the
 * caller's anonymous/identified user; webhook and reconciliation paths derive
 * identity from the transaction. Encoding this as a discriminated union makes
 * the requirement a type-level constraint at every call site.
 *
 * `sdkTransactionId` is the StoreKit transaction id the SDK client observed —
 * forwarded so it can serve as the final fallback for `providerTransactionId`
 * when the decoded transaction itself has no usable identifiers.
 */
export type RecordTransactionInput = RecordTransactionInputBase &
  (
    | { readonly source: "sdk"; readonly distinctId: string; readonly sdkTransactionId?: string }
    | { readonly source: "webhook" | "reconciliation"; readonly distinctId?: never }
  );

/** Epoch millis (Apple's date encoding) → a `Date`. */
const dateFromMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/**
 * The StoreKit transaction id the SDK client observed, present only on the
 * `"sdk"` arm of {@link RecordTransactionInput}.
 */
const sdkTransactionIdOf = (input: RecordTransactionInput): string | typeof Schema.Undefined.Type => {
  if (input.source === "sdk") {
    return input.sdkTransactionId;
  }
  return undefined;
};

/** The caller-supplied distinct id, present only on the `"sdk"` arm. */
const sdkDistinctIdOf = (input: RecordTransactionInput): string | typeof Schema.Undefined.Type => {
  if (input.source === "sdk") {
    return input.distinctId;
  }
  return undefined;
};

const optionSpanAttribute = <A>(
  value: Option.Option<A>,
  map: (value: A) => unknown = (some) => some,
): unknown => Option.match(value, { onNone: () => undefined, onSome: (some) => map(some) });

const annotateRecordTransaction = (input: RecordTransactionInput) =>
  Effect.gen(function* () {
    const transaction = input.decodedTransaction;
    yield* Effect.annotateCurrentSpan(
      "voidhash.payment_provider.configuration_id",
      input.configuration.id,
    );
    yield* Effect.annotateCurrentSpan("voidhash.project.id", input.project.id);
    yield* Effect.annotateCurrentSpan("voidhash.purchase.source", input.source);
    if (input.notificationUUID) {
      yield* Effect.annotateCurrentSpan("voidhash.webhook.id", input.notificationUUID);
    }
    const originalTransactionId = optionSpanAttribute(transaction.originalTransactionId);
    if (originalTransactionId !== undefined) {
      yield* Effect.annotateCurrentSpan("voidhash.transaction.original_id", originalTransactionId);
    }
    const providerProductKey = optionSpanAttribute(transaction.productId);
    if (providerProductKey !== undefined) {
      yield* Effect.annotateCurrentSpan(
        "voidhash.payment_provider.provider_product_key",
        providerProductKey,
      );
    }
    const transactionId = optionSpanAttribute(transaction.transactionId);
    if (transactionId !== undefined) {
      yield* Effect.annotateCurrentSpan(
        "voidhash.transaction.provider_transaction_id",
        transactionId,
      );
    }
  });

const purchaseProcessingResultKind = (result: PurchaseProcessingResult) => {
  if (result.idempotent) {
    return "idempotent";
  }
  if (
    Arr.isReadonlyArrayEmpty(result.analyticsEventIds) &&
    Option.isNone(result.purchaseId) &&
    Option.isNone(result.subscriptionId) &&
    Option.isNone(result.transactionId)
  ) {
    return "ignored";
  }
  return "applied";
};

const purchaseProcessingResultSpanAttributes = (result: PurchaseProcessingResult) => ({
  "app_store.purchase_processing_result": purchaseProcessingResultKind(result),
});

const isPurchaseProcessingResultLike = (value: unknown): value is PurchaseProcessingResult =>
  P.isObject(value) &&
  value !== null &&
  "analyticsEventIds" in value &&
  "changedGrantIds" in value &&
  "idempotent" in value &&
  "personId" in value;

const annotatePurchaseProcessingResult = (result: unknown) =>
  Effect.gen(function* () {
    if (!isPurchaseProcessingResultLike(result)) {
      return;
    }
    yield* Effect.annotateCurrentSpan(purchaseProcessingResultSpanAttributes(result));
    yield* Effect.annotateCurrentSpan("voidhash.person.id", result.personId);
    if (Option.isSome(result.purchaseId)) {
      yield* Effect.annotateCurrentSpan("voidhash.purchase.id", result.purchaseId.value);
    }
    if (Option.isSome(result.subscriptionId)) {
      yield* Effect.annotateCurrentSpan("voidhash.subscription.id", result.subscriptionId.value);
    }
    if (Option.isSome(result.transactionId)) {
      yield* Effect.annotateCurrentSpan("voidhash.transaction.id", result.transactionId.value);
    }
  });

const make = Effect.fn("make")(function* () {
  const queries = yield* AppStorePaymentProviderServiceQueries;
  const personIdentityService = yield* PersonIdentityService;
  const purchaseProcessingService = yield* PurchaseProcessor;
  const appStoreServerSdk = yield* AppStoreServerSdk;
  const verifierEnvironmentOverride = yield* AppStoreVerifierEnvironmentOverride;
  const verifierFactory = yield* AppStoreSignedDataVerifierFactoryOverride;
  const apiClientFactory = yield* AppStoreServerApiClientFactoryOverride;
  /**
   * Captured at construction time so the per-call money helpers
   * ({@link _money}, {@link _moneyForRenewalPrice}) can pass the resolved
   * instance directly to {@link buildAppStoreMoney}. Without this capture,
   * the FX dependency would propagate as an `R` on every `record*` method,
   * which would force every downstream caller (webhook handler, SDK boundary,
   * reconciliation) to provide `FxRateService` in their own context.
   */
  const fxRateService = yield* FxRateService;
  // Encrypts/decrypts the secret `inAppPurchasePrivateKey` config field at the
  // write (validate) and read (SDK-context build) boundaries.
  const secretCrypto = yield* PaymentConfigSecretCrypto;

  const _withRecordTransactionObservability = <A, E, R, I extends RecordTransactionInput>(
    effect: Effect.Effect<A, E, R>,
    input: I,
  ) =>
    Effect.fn("_withRecordTransactionObservability")(function* () {
      yield* annotateRecordTransaction(input);
      const result = yield* effect;
      yield* annotatePurchaseProcessingResult(result);
      return result;
    })();

  // The config-write surface (schema validation, key derivation, default
  // configuration blobs, and encrypt-on-write of the secret Apple PKCS8 key) is
  // shared with the admin config flow — see `./config-provider.ts`. The engine
  // adds the per-tenant SDK helpers and `record*` methods below, but defers to
  // the same single source of truth for what a valid stored configuration is.
  const configProvider = makeAppStoreConfigProvider(secretCrypto);

  const provider = {
    ...configProvider,
    globalConfigurationSchema,
    productConfigurationSchema,
  } satisfies AppStorePaymentProviderShape;

  /**
   * Exposes the shared per-tenant SDK helpers so callers (webhook handler,
   * SDK boundary) can build verifiers and REST clients without yielding the
   * raw `AppStoreServerSdk` service themselves. Parses the stored
   * configuration row first; failures propagate as schema errors.
   */
  const buildSdkContextFromConfiguration = Effect.fn("buildSdkContextFromConfiguration")(function* (
    configuration: DbPaymentProviderConfiguration,
  ) {
    yield* Effect.annotateCurrentSpan(
      "voidhash.payment_provider.configuration_id",
      configuration.id,
    );
    yield* Effect.annotateCurrentSpan("voidhash.project.id", configuration.projectId);
    yield* Effect.annotateCurrentSpan("voidhash.payment_provider.id", configuration.providerId);
    const parsed = yield* Schema.decodeUnknownEffect(globalConfigurationSchema)(
      configuration.configuration,
    );
    // Decrypt the Apple PKCS8 key before handing it to the SDK client. Rows
    // written before the encryption seam are plaintext and pass through.
    const inAppPurchasePrivateKey = yield* secretCrypto.decrypt(parsed.inAppPurchasePrivateKey);
    return buildAppStoreSdkContext(appStoreServerSdk, {
      ...parsed,
      apiClientFactory,
      inAppPurchasePrivateKey,
      verifierEnvironmentOverride,
      verifierFactory,
    });
  });

  const _resolveDistinctIdToPersonId = Effect.fn("_resolveDistinctIdToPersonId")(function* (input: {
    readonly distinctId: string;
    readonly eventTimestamp: Date;
    readonly projectId: string;
    /** Origin stamped on the person row when this call creates it. Defaults to `IOS`. */
    readonly origin?: PersonOriginValue;
  }) {
    const result = yield* personIdentityService.resolveDistinctId({
      distinctId: input.distinctId,
      eventTimestamp: input.eventTimestamp,
      origin: input.origin ?? PersonOrigin.IOS,
      projectId: input.projectId,
      setAttributes: {},
      setOnceAttributes: {},
      shouldCreatePerson: true,
    });
    if (!result.identity.personId) {
      return yield* Effect.fail(
        new AppStorePaymentProviderServiceError({
          cause: "App Store transaction resolved without person id",
        }),
      );
    }
    return result.identity.personId;
  });

  const _resolvePersonForAppStoreTransaction = Effect.fn("_resolvePersonForAppStoreTransaction")(
    function* (input: {
      readonly projectId: string;
      readonly organizationId: string;
      readonly paymentProviderConfigurationId: string;
      readonly source: "sdk" | "webhook" | "reconciliation";
      readonly distinctId?: string;
      readonly appAccountToken?: string;
      readonly providerTransactionId: string;
      readonly providerSubscriptionId?: string;
      readonly personIdentifier: string;
      readonly providerEnvironment: ProviderEnvironmentValue;
      readonly transferMode: typeof SubscriptionTransferMode.Type;
      readonly occurredAt: Date;
    }) {
      // Apple emits appAccountToken as an uppercase UUID; our derived tokens
      // and stored bindings are lowercase. Canonicalize before any lookup.
      const appAccountToken = input.appAccountToken?.toLowerCase();
      yield* Effect.annotateCurrentSpan(
        "voidhash.payment_provider.configuration_id",
        input.paymentProviderConfigurationId,
      );
      yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
      yield* Effect.annotateCurrentSpan("voidhash.organization.id", input.organizationId);
      yield* Effect.annotateCurrentSpan("voidhash.purchase.source", input.source);
      yield* Effect.annotateCurrentSpan(
        "voidhash.transaction.provider_transaction_id",
        input.providerTransactionId,
      );
      if (input.distinctId) {
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
      }
      if (input.source === "sdk") {
        if (!input.distinctId) {
          return yield* new AppStorePaymentProviderSdkTransactionMissingDistinctIdError({
            providerTransactionId: input.providerTransactionId,
          });
        }
        const sdkPersonId = yield* _resolveDistinctIdToPersonId({
          distinctId: input.distinctId,
          eventTimestamp: input.occurredAt,
          projectId: input.projectId,
        });
        let resolvedSdkPersonId = sdkPersonId;

        /**
         * SDK identity-rebind path: a webhook arrived first and bound this
         * `personIdentifier` (typically the originalTransactionId) to some
         * person, and the SDK confirmation now reveals the SDK-authenticated
         * person. What to do depends on whether the previously-bound person is
         * the webhook-created anonymous stand-in or a real identified user —
         * see the branch below.
         */
        const existingExternal = yield* queries.findExternalIdentifier({
          identifier: input.personIdentifier,
          projectId: input.projectId,
          serviceId: "apple-app-store",
        });

        if (Option.isSome(existingExternal)) {
          if (existingExternal.value.personId !== sdkPersonId) {
            const previousIsWebhookStandIn = yield* queries.isAppStoreWebhookStandInPerson({
              personId: existingExternal.value.personId,
              projectId: input.projectId,
            });

            if (previousIsWebhookStandIn) {
              yield* Effect.annotateCurrentSpan({
                "app_store.identity_result": "webhook_stand_in_merge",
              });
              /**
               * Webhook stand-in merge (the original behaviour): the webhook
               * bound `personIdentifier` to a synthetic anonymous stand-in
               * because the notification arrived before SDK confirmation. The
               * SDK confirmation now reveals the authenticated identity —
               * stitch both identity clusters via `identifyDistinctId`, then
               * rebind the external identifier to its canonical survivor.
               */
              const previousDistinctId = yield* queries.findDistinctIdForPerson({
                personId: existingExternal.value.personId,
                projectId: input.projectId,
              });
              if (Option.isSome(previousDistinctId)) {
                const mergeResult = yield* personIdentityService
                  .identifyDistinctId({
                    distinctId: input.distinctId,
                    eventTimestamp: input.occurredAt,
                    origin: PersonOrigin.IOS,
                    previousDistinctId: previousDistinctId.value,
                    projectId: input.projectId,
                    setAttributes: {},
                    setOnceAttributes: {},
                  })
                  .pipe(
                    Effect.map(Option.some),
                    Effect.catch((error: unknown) =>
                      Effect.logWarning(
                        "App Store SDK identity rebind: identifyDistinctId merge failed; continuing with identifier rebind only",
                        {
                          cause: error,
                          personIdentifier: input.personIdentifier,
                          previousDistinctId: previousDistinctId.value,
                          sdkDistinctId: input.distinctId,
                        },
                      ).pipe(Effect.as(Option.none())),
                    ),
                  );
                resolvedSdkPersonId = Option.match(mergeResult, {
                  onNone: () => sdkPersonId,
                  onSome: (result) => result.identity.personId ?? sdkPersonId,
                });
              }
              yield* queries.rebindExternalIdentifier({
                id: existingExternal.value.id,
                newPersonId: resolvedSdkPersonId,
              });
            } else {
              /**
               * Cross-owner restore between two real persons: a genuine
               * person — an anonymous SDK user or an identified user —
               * previously owned this `personIdentifier`, and a different
               * person has now restored it on this device. This is NOT an
               * identity merge: both persons stay intact; only the specific
               * subscription / non-consumable purchase tied to
               * `personIdentifier` moves, governed by the configured
               * `transferMode`.
               *
               * Transfer the entitlement FIRST and rebind the identifier
               * LAST, so a crash between the two is self-healing: a retried
               * delivery re-detects the mismatch (identifier still on the
               * previous owner), the transfer no-ops (row already moved),
               * and the rebind completes. On transfer failure the rebind is
               * skipped so a later delivery retries the whole sequence.
               */
              const transferred = yield* Effect.fn("transferred")(function* () {
                // Look the entitlement up by its real store keys, NOT by
                // `personIdentifier`: with account tokens the identifier is the
                // derived UUID (never a store key), so keying the lookups on it
                // would always miss → silently rebind without transferring. For
                // legacy flows `personIdentifier === originalTransactionId ===
                // providerSubscriptionId` (subscriptions) and `=== transactionId
                // === providerTransactionId` (one-time charges), so this is
                // equivalent there.
                const subscription = yield* queries.findSubscriptionByStoreSubscriptionId({
                  storeSubscriptionId: input.providerSubscriptionId ?? input.personIdentifier,
                });
                if (Option.isSome(subscription)) {
                  yield* purchaseProcessingService.transferSubscription({
                    fromPersonId: existingExternal.value.personId,
                    occurredAt: input.occurredAt,
                    organizationId: input.organizationId,
                    paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                    projectId: input.projectId,
                    providerId: "apple-app-store",
                    source: "sdk",
                    subscriptionId: subscription.value.id,
                    toPersonId: sdkPersonId,
                    transferMode: input.transferMode,
                    triggerReason: "appstore_restore",
                  });
                  return true;
                }
                const purchase = yield* queries.findPurchaseByProviderKey({
                  providerKey: input.providerTransactionId,
                });
                if (Option.isSome(purchase) && purchase.value.type === PurchaseType.OneTime) {
                  yield* purchaseProcessingService.transferPurchase({
                    fromPersonId: existingExternal.value.personId,
                    occurredAt: input.occurredAt,
                    organizationId: input.organizationId,
                    paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                    projectId: input.projectId,
                    providerId: "apple-app-store",
                    purchaseId: purchase.value.id,
                    source: "sdk",
                    toPersonId: sdkPersonId,
                    transferMode: input.transferMode,
                    triggerReason: "appstore_restore",
                  });
                }
                // Consumable → no transfer (Apple never restores consumables).
                // Nothing found → first-seen; the identifier rebind alone
                // suffices.
                return true;
              })().pipe(
                Effect.catch((error: unknown) =>
                  Effect.logWarning(
                    "App Store cross-owner transfer failed; skipping identifier rebind so a later delivery retries",
                    {
                      cause: error,
                      personIdentifier: input.personIdentifier,
                      previousPersonId: existingExternal.value.personId,
                      sdkPersonId,
                    },
                  ).pipe(Effect.as(false)),
                ),
              );
              if (transferred) {
                yield* queries.rebindExternalIdentifier({
                  id: existingExternal.value.id,
                  newPersonId: sdkPersonId,
                });
              }
              yield* Effect.annotateCurrentSpan({
                "app_store.identity_result": pick(
                  transferred,
                  "cross_owner_transfer",
                  "cross_owner_transfer_failed",
                ),
              });
            }
          } else {
            yield* Effect.annotateCurrentSpan({
              "app_store.identity_result": "same_person",
            });
          }
        } else {
          yield* Effect.annotateCurrentSpan({
            "app_store.identity_result": "new_external_identifier",
          });
          yield* queries.createExternalIdentifier({
            id: generateId("personDistinctId"),
            identifier: input.personIdentifier,
            isDefault: true,
            personId: sdkPersonId,
            projectId: input.projectId,
            serviceId: "apple-app-store",
          });
        }

        // Lazily backfill the account-token binding for this series, but ONLY
        // when the transaction's token actually derives from THIS person's
        // distinctId. On a cross-owner restore the JWS carries the original
        // buyer's token — binding it here would poison the buyer's mapping.
        if (appAccountToken) {
          const expectedToken = yield* deriveAccountToken(input.distinctId);
          if (appAccountToken === expectedToken) {
            yield* queries.upsertExternalIdentifier({
              id: generateId("personDistinctId"),
              identifier: appAccountToken,
              isDefault: true,
              personId: resolvedSdkPersonId,
              projectId: input.projectId,
              serviceId: ACCOUNT_TOKEN_SERVICE_ID,
            });
          }
        }

        return { personId: resolvedSdkPersonId };
      }

      // Back-compat: integrations that set appAccountToken to a literal
      // distinctId (a UUID-shaped one) resolve directly. A SHA-1-derived token
      // colliding byte-for-byte with an unrelated distinctId is ~2^-122, so no
      // false-positive defence is warranted.
      if (appAccountToken) {
        const distinctIdIdentity = yield* queries.findPersonIdentityByDistinctId({
          distinctId: appAccountToken,
          projectId: input.projectId,
        });
        if (Option.isSome(distinctIdIdentity)) {
          yield* Effect.annotateCurrentSpan({
            "app_store.identity_result": "app_account_token",
          });
          return {
            personId: yield* queries.resolveCanonicalPersonId({
              personId: distinctIdIdentity.value.personId,
            }),
          };
        }
      }

      // Existing `apple-app-store` binding (keyed on originalTransactionId /
      // transactionId, or — for token-bearing series — the token itself).
      // Checked before the account-token binding because it reflects
      // cross-owner transfers that the per-user token binding deliberately
      // doesn't. Person merges do not repoint provider identifiers, so
      // canonicalize to avoid resolving a post-merge renewal to the archived
      // source person.
      const externalIdentifier = yield* queries.findExternalIdentifier({
        identifier: input.personIdentifier,
        projectId: input.projectId,
        serviceId: "apple-app-store",
      });
      if (Option.isSome(externalIdentifier)) {
        yield* Effect.annotateCurrentSpan({
          "app_store.identity_result": "external_identifier",
        });
        return {
          personId: yield* queries.resolveCanonicalPersonId({
            personId: externalIdentifier.value.personId,
          }),
        };
      }

      // Pre-registered account-token binding (written at identity
      // create/identify) — the instant-resolution path for a user's first-ever
      // webhook, before any SDK transaction sync has bound the series.
      if (appAccountToken) {
        const tokenBinding = yield* queries.findExternalIdentifier({
          identifier: appAccountToken,
          projectId: input.projectId,
          serviceId: ACCOUNT_TOKEN_SERVICE_ID,
        });
        if (Option.isSome(tokenBinding)) {
          yield* Effect.annotateCurrentSpan({
            "app_store.identity_result": "account_token_binding",
          });
          return {
            personId: yield* queries.resolveCanonicalPersonId({
              personId: tokenBinding.value.personId,
            }),
          };
        }
      }

      const anonymousDistinctId = buildAppStoreWebhookAnonymousDistinctId({
        personIdentifier: input.personIdentifier,
        providerEnvironment: input.providerEnvironment,
      });
      const personId = yield* _resolveDistinctIdToPersonId({
        distinctId: anonymousDistinctId,
        eventTimestamp: input.occurredAt,
        origin: PersonOrigin.AppStoreWebhook,
        projectId: input.projectId,
      });

      yield* queries.createExternalIdentifier({
        id: generateId("personDistinctId"),
        identifier: input.personIdentifier,
        isDefault: true,
        personId,
        projectId: input.projectId,
        serviceId: "apple-app-store",
      });

      yield* Effect.annotateCurrentSpan({
        "app_store.identity_result": "webhook_stand_in",
      });
      return { personId };
    },
  );

  /**
   * Builds the `PurchaseActionContext` shared by every per-action method on
   * `PurchaseProcessingService`. Per-method extras (money, dates, trial flag,
   * etc.) are spread onto this base by the matching `record*` method below.
   *
   * `idempotencyKey` is derived here (not at each call site) so every App
   * Store record path goes through the same key-construction rules. The
   * helper returns an Effect that fails with
   * `AppStorePurchaseProcessingIdempotencyKeyDerivationError` when the JWS
   * lacks the inputs we need — always an upstream bug, propagated to the
   * caller.
   */
  const _buildPurchaseActionBase = (input: {
    readonly decodedTransaction: JWSTransactionDecodedPayload;
    readonly decodedRenewalInfo: Option.Option<JWSRenewalInfoDecodedPayload>;
    readonly idempotencyEventType: AppStorePurchaseProcessingEventType;
    readonly notificationUUID?: string;
    readonly sdkTransactionId?: string;
    readonly occurredAt: Date;
    readonly organizationId: string;
    readonly paymentProviderConfigurationId: string;
    readonly paymentProviderConfigurationProductId: string;
    readonly personId: string;
    readonly projectId: string;
    readonly providerEnvironment: ProviderEnvironmentValue;
    readonly providerEventType: string;
    readonly receivedAt: Date;
    readonly source: "sdk" | "webhook" | "reconciliation";
  }) =>
    Effect.fn("_buildPurchaseActionBase")(function* () {
      const transaction = input.decodedTransaction;
      const idempotencyKey = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: transaction,
        decodedRenewalInfo: input.decodedRenewalInfo,
        eventType: input.idempotencyEventType,
        sdkTransactionId: input.sdkTransactionId,
      });
      yield* Effect.annotateCurrentSpan("voidhash.purchase.idempotency_key", idempotencyKey);
      const base: typeof PurchaseActionContext.Type = {
        idempotencyKey,
        occurredAt: input.occurredAt,
        organizationId: input.organizationId,
        paymentProviderConfigurationId: input.paymentProviderConfigurationId,
        paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
        personId: input.personId,
        projectId: input.projectId,
        providerEnvironment: input.providerEnvironment,
        providerEventType: input.providerEventType,
        providerId: constant("apple-app-store"),
        providerSubscriptionId: getAppStoreProviderSubscriptionId(transaction),
        providerTransactionId: getAppStoreProviderTransactionId({
          decodedTransaction: transaction,
          sdkTransactionId: input.sdkTransactionId,
        }),
        providerWebhookNotificationId: Option.fromNullishOr(input.notificationUUID),
        rawProviderPayload: Option.some(transaction),
        receivedAt: input.receivedAt,
        source: input.source,
      };
      return base;
    })();

  /**
   * Builds the platform-neutral money record (gross / commission / tax /
   * proceeds in original currency + USD mirror) from a decoded JWS. Delegates
   * to {@link buildAppStoreMoney} which owns commission rate selection
   * (Small Business Program / year-2+) and tax estimation from the storefront.
   */
  const _money = (
    decodedTransaction: JWSTransactionDecodedPayload,
    globalConfiguration: AppStoreGlobalConfiguration,
    occurredAt: Date,
  ) =>
    buildAppStoreMoney({
      decoded: decodedTransaction,
      fxRateService,
      globalConfiguration,
      occurredAt,
    });

  /**
   * Builds a synthetic `JWSTransactionDecodedPayload` carrying just the price
   * and currency from a `JWSRenewalInfoDecodedPayload`. Used by the price-
   * increase notification, where the new price lives on the renewal info
   * instead of the transaction. The result is fed through
   * {@link buildAppStoreMoney} so it picks up commission and tax via the
   * same rules as the inline-transaction path; everything else (the
   * transaction's storefront, ownership type, etc.) is preserved from the
   * underlying transaction.
   */
  const _moneyForRenewalPrice = (
    decodedTransaction: JWSTransactionDecodedPayload,
    globalConfiguration: AppStoreGlobalConfiguration,
    occurredAt: Date,
    renewalPriceMilliunits: number,
    renewalCurrency: string,
  ) =>
    buildAppStoreMoney({
      decoded: {
        ...decodedTransaction,
        currency: Option.some(renewalCurrency),
        price: Option.some(renewalPriceMilliunits),
      },
      fxRateService,
      globalConfiguration,
      occurredAt,
    });

  /**
   * App-Store-specific resolution shared by every `record*` method: compute
   * identifiers, resolve the person, look up the product mapping, build the
   * shared `PurchaseActionContext`.
   *
   * Branches:
   * - `"ignored"` — Apple-valid payload without a usable `productId`. Caller
   *   short-circuits with `makeIgnoredPurchaseProcessingResult()`.
   * - `"resolved"` — caller proceeds with normal processing.
   *
   * Idempotency on duplicate webhook / SDK delivery is enforced downstream by
   * `PurchaseProcessingService`'s purchase-ledger reservation plus DB-level
   * UNIQUE constraints on the provider id columns.
   */
  const _resolveAppStorePurchaseContext = (
    input: RecordTransactionInput,
    providerEventType: AppStorePurchaseProcessingEventType,
  ) =>
    Effect.fn("_resolveAppStorePurchaseContext")(function* () {
      yield* Effect.annotateCurrentSpan("voidhash.payment_provider.event_type", providerEventType);
      const providerTransactionIdOp = getAppStoreProviderTransactionId({
        decodedTransaction: input.decodedTransaction,
        sdkTransactionId: sdkTransactionIdOf(input),
      });
      if (Option.isNone(providerTransactionIdOp)) {
        return yield* new AppStorePaymentProviderServiceError({
          cause:
            "App Store transaction has no transactionId (missing from decoded JWS and SDK fallback)",
        });
      }
      const providerTransactionId = providerTransactionIdOp.value;

      const occurredAt = Option.match(input.decodedTransaction.purchaseDate, {
        onNone: () => input.receivedAt,
        onSome: (ms) => dateFromMillis(ms),
      });
      const productId = Option.getOrUndefined(input.decodedTransaction.productId);
      if (!productId) {
        return { kind: constant("ignored") };
      }

      const personIdentifierOp = getAppStorePersonIdentifier(input.decodedTransaction);
      if (input.source !== "sdk" && Option.isNone(personIdentifierOp)) {
        return yield* new AppStorePaymentProviderTransactionMissingPersonIdentifierError({
          providerTransactionId,
        });
      }
      // Parsed up-front (before person resolution) so the cross-owner transfer
      // mode is available to `_resolvePersonForAppStoreTransaction`.
      const parsedConfiguration = yield* Schema.decodeUnknownEffect(globalConfigurationSchema)(
        input.configuration.configuration,
      );

      const resolvedPerson = yield* _resolvePersonForAppStoreTransaction({
        appAccountToken: Option.getOrUndefined(input.decodedTransaction.appAccountToken),
        distinctId: sdkDistinctIdOf(input),
        occurredAt,
        organizationId: input.project.organizationId,
        paymentProviderConfigurationId: input.configuration.id,
        personIdentifier: Option.getOrElse(personIdentifierOp, () => providerTransactionId),
        projectId: input.project.id,
        providerEnvironment: input.providerEnvironment,
        providerSubscriptionId: Option.getOrUndefined(
          getAppStoreProviderSubscriptionId(input.decodedTransaction),
        ),
        providerTransactionId,
        source: input.source,
        transferMode:
          parsedConfiguration.subscriptionTransferMode ?? DEFAULT_SUBSCRIPTION_TRANSFER_MODE,
      });
      yield* Effect.annotateCurrentSpan("voidhash.person.id", resolvedPerson.personId);

      const providerProduct = yield* queries.findPaymentProviderConfigurationProductByPrimaryKey({
        paymentProviderConfigurationId: input.configuration.id,
        providerProductKey: productId,
      });
      if (!providerProduct) {
        return yield* new AppStorePaymentProviderProductNotMappedError({
          paymentProviderConfigurationId: input.configuration.id,
          providerProductKey: productId,
        });
      }
      yield* Effect.annotateCurrentSpan("voidhash.payment_provider.product_id", providerProduct.id);
      yield* Effect.annotateCurrentSpan("voidhash.product.id", providerProduct.productId);

      const money = yield* _money(input.decodedTransaction, parsedConfiguration, occurredAt);
      const base = yield* _buildPurchaseActionBase({
        decodedTransaction: input.decodedTransaction,
        decodedRenewalInfo: input.decodedRenewalInfo,
        idempotencyEventType: providerEventType,
        notificationUUID: input.notificationUUID,
        occurredAt,
        organizationId: input.project.organizationId,
        paymentProviderConfigurationId: input.configuration.id,
        paymentProviderConfigurationProductId: providerProduct.id,
        personId: resolvedPerson.personId,
        projectId: input.project.id,
        providerEnvironment: input.providerEnvironment,
        providerEventType,
        receivedAt: input.receivedAt,
        sdkTransactionId: sdkTransactionIdOf(input),
        source: input.source,
      });

      return {
        base,
        decodedTransaction: input.decodedTransaction,
        globalConfiguration: parsedConfiguration,
        kind: constant("resolved"),
        money,
        occurredAt,
        subtype: input.subtype,
      };
    })();

  /**
   * Records a new App Store purchase. Used for both auto-renewable subscription
   * initial buys (Apple `SUBSCRIBED`) and non-renewing / consumable / non-
   * consumable charges (Apple `ONE_TIME_CHARGE`), plus the SDK path where the
   * client just observed a successful StoreKit transaction. Routes to
   * `startSubscription`, `renewSubscription`, or `completeOneTimePurchase`
   * depending on the decoded transaction shape.
   */
  const recordPurchase = Effect.fn("recordPurchase")(function* (input: RecordTransactionInput) {
    const isRenewal =
      input.subtype === "RESUBSCRIBE" ||
      Option.exists(input.decodedTransaction.transactionReason, (reason) => reason === "RENEWAL");
    const providerEventType = pick(isRenewal, "renewal", "purchase");
    const ctx = yield* _resolveAppStorePurchaseContext(input, providerEventType);
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }

    const isAutoRenewableSubscription = Option.exists(
      ctx.decodedTransaction.type,
      (type) => type === "Auto-Renewable Subscription",
    );

    if (isAutoRenewableSubscription) {
      const startsAt = Option.match(ctx.decodedTransaction.originalPurchaseDate, {
        onNone: () => ctx.occurredAt,
        onSome: (ms) => dateFromMillis(ms),
      });
      const isTrial = Option.exists(
        ctx.decodedTransaction.offerDiscountType,
        (offer) => offer === "FREE_TRIAL",
      );
      const expiresAt = Option.map(ctx.decodedTransaction.expiresDate, (ms) => dateFromMillis(ms));

      if (isRenewal) {
        return yield* purchaseProcessingService.renewSubscription({
          ...ctx.base,
          expiresAt,
          isTrial,
          money: ctx.money,
          renewedAt: ctx.occurredAt,
          startsAt,
        });
      }

      return yield* purchaseProcessingService.startSubscription({
        ...ctx.base,
        expiresAt,
        isTrial,
        money: ctx.money,
        purchasedAt: ctx.occurredAt,
        startsAt,
      });
    }

    const isConsumable = Option.exists(
      ctx.decodedTransaction.type,
      (type) => type === "Consumable",
    );
    return yield* purchaseProcessingService.completeOneTimePurchase({
      ...ctx.base,
      money: ctx.money,
      purchaseType: pick(isConsumable, constant("consumable"), constant("one-time")),
      purchasedAt: ctx.occurredAt,
    });
  }, _withRecordTransactionObservability);

  /**
   * Records an auto-renewable subscription renewal (Apple `DID_RENEW`,
   * including the `BILLING_RECOVERY` subtype).
   */
  const recordSubscriptionRenewed = Effect.fn("recordSubscriptionRenewed")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "renewal");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.renewSubscription({
      ...ctx.base,
      expiresAt: Option.map(ctx.decodedTransaction.expiresDate, (ms) => dateFromMillis(ms)),
      isTrial: Option.exists(
        ctx.decodedTransaction.offerDiscountType,
        (offer) => offer === "FREE_TRIAL",
      ),
      money: ctx.money,
      renewedAt: ctx.occurredAt,
      startsAt: Option.match(ctx.decodedTransaction.originalPurchaseDate, {
        onNone: () => ctx.occurredAt,
        onSome: (ms) => dateFromMillis(ms),
      }),
    });
  }, _withRecordTransactionObservability);

  /**
   * Records that a subscription's billing period ended without further
   * renewal (Apple `EXPIRED`, including grace-period elapse via
   * `GRACE_PERIOD_EXPIRED`).
   */
  const recordSubscriptionExpired = Effect.fn("recordSubscriptionExpired")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "expired");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    const expiredAt = Option.match(ctx.decodedTransaction.expiresDate, {
      onNone: () => ctx.occurredAt,
      onSome: (ms) => dateFromMillis(ms),
    });
    return yield* purchaseProcessingService.expireSubscription({
      ...ctx.base,
      expiredAt,
    });
  }, _withRecordTransactionObservability);

  /**
   * Records that the user requested cancellation of an auto-renewable
   * subscription (Apple `DID_CHANGE_RENEWAL_STATUS` with subtype
   * `AUTO_RENEW_DISABLED`). Apple keeps the user entitled until the current
   * period expires, so `cancelAtPeriodEnd` reflects what the caller passed.
   */
  const recordSubscriptionCanceled = Effect.fn("recordSubscriptionCanceled")(function* (
    input: RecordTransactionInput & { readonly cancelAtPeriodEnd: boolean },
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "canceled");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.cancelSubscription({
      ...ctx.base,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      canceledAt: ctx.occurredAt,
      cancellationReason: Option.fromNullishOr(ctx.subtype),
    });
  }, _withRecordTransactionObservability);

  /**
   * Records an Apple-issued refund of a transaction (Apple `REFUND`).
   */
  const recordRefund = Effect.fn("recordRefund")(function* (input: RecordTransactionInput) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "refund");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    const refundedAt = Option.match(ctx.decodedTransaction.revocationDate, {
      onNone: () => ctx.occurredAt,
      onSome: (ms) => dateFromMillis(ms),
    });
    return yield* purchaseProcessingService.refundPurchase({
      ...ctx.base,
      refundReason: Option.fromNullishOr(ctx.subtype),
      refundedAt,
    });
  }, _withRecordTransactionObservability);

  /**
   * Records that Apple revoked an entitlement, typically a Family Sharing
   * member's access (Apple `REVOKE`).
   */
  const recordEntitlementRevoked = Effect.fn("recordEntitlementRevoked")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "revoke");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    const revokedAt = Option.match(ctx.decodedTransaction.revocationDate, {
      onNone: () => ctx.occurredAt,
      onSome: (ms) => dateFromMillis(ms),
    });
    const isAutoRenewableSubscription = Option.exists(
      ctx.decodedTransaction.type,
      (type) => type === "Auto-Renewable Subscription",
    );
    if (!isAutoRenewableSubscription) {
      return yield* purchaseProcessingService.revokePurchase({
        ...ctx.base,
        revocationReason: Option.fromNullishOr(ctx.subtype),
        revokedAt,
      });
    }
    return yield* purchaseProcessingService.revokeSubscription({
      ...ctx.base,
      revocationReason: Option.fromNullishOr(ctx.subtype),
      revokedAt,
    });
  }, _withRecordTransactionObservability);

  /**
   * Records that Apple reversed a prior refund (Apple `REFUND_REVERSED`). The
   * reversed transaction's `revocationDate` is cleared in the new payload; we
   * anchor `reversedAt` on `signedDate` (when Apple signed the reversal),
   * falling back to `occurredAt` if signedDate is absent.
   */
  const recordRefundReversed = Effect.fn("recordRefundReversed")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "refund_reversed");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    const reversedAt = Option.match(ctx.decodedTransaction.signedDate, {
      onNone: () => ctx.occurredAt,
      onSome: (ms) => dateFromMillis(ms),
    });
    return yield* purchaseProcessingService.reverseRefund({
      ...ctx.base,
      reversedAt,
    });
  }, _withRecordTransactionObservability);

  /** `DID_FAIL_TO_RENEW` — billing-retry / grace state. */
  const recordBillingRetry = Effect.fn("recordBillingRetry")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "billing_retry");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    /**
     * Apple's `gracePeriodExpiresDate` lives on `renewalInfo`, not on the
     * decoded transaction. When the webhook handler decoded `signedRenewalInfo`
     * we have it here; otherwise the field stays absent and we record the
     * billing-retry start without a grace deadline.
     */
    const gracePeriodExpiresAt = Option.flatMap(input.decodedRenewalInfo, (renewalInfo) =>
      Option.map(renewalInfo.gracePeriodExpiresDate, (ms) => dateFromMillis(ms)),
    );
    return yield* purchaseProcessingService.enterBillingRetry({
      ...ctx.base,
      billingRetryAt: ctx.occurredAt,
      gracePeriodExpiresAt,
    });
  }, _withRecordTransactionObservability);

  /** `RENEWAL_EXTENDED` / `RENEWAL_EXTENSION` — service-issued period extension. */
  const recordSubscriptionExtended = Effect.fn("recordSubscriptionExtended")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "extended");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    if (Option.isNone(ctx.decodedTransaction.expiresDate)) {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.extendSubscription({
      ...ctx.base,
      extendedTo: dateFromMillis(ctx.decodedTransaction.expiresDate.value),
    });
  }, _withRecordTransactionObservability);

  /**
   * `DID_CHANGE_RENEWAL_PREF` — customer selected a different product for the
   * next renewal. Records the intent; the actual product swap happens at the
   * next renewal via `renewSubscription`.
   */
  const recordRenewalPreferenceChange = Effect.fn("recordRenewalPreferenceChange")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "renewal_pref_change");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    if (Option.isNone(ctx.decodedTransaction.productId)) {
      return makeIgnoredPurchaseProcessingResult();
    }
    // Try to resolve the new product mapping; absent is OK (records intent).
    const newProduct = yield* queries.findPaymentProviderConfigurationProductByPrimaryKey({
      paymentProviderConfigurationId: ctx.base.paymentProviderConfigurationId,
      providerProductKey: ctx.decodedTransaction.productId.value,
    });
    return yield* purchaseProcessingService.changeRenewalPreference({
      ...ctx.base,
      newPaymentProviderConfigurationProductId: Option.fromNullishOr(newProduct?.id),
      newProviderProductKey: ctx.decodedTransaction.productId.value,
    });
  }, _withRecordTransactionObservability);

  /** `OFFER_REDEEMED` — promotional / introductory / win-back offer applied. */
  const recordOfferRedeemed = Effect.fn("recordOfferRedeemed")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "offer_redeemed");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.redeemOffer({
      ...ctx.base,
      offerId: ctx.decodedTransaction.offerIdentifier,
      redeemedAt: ctx.occurredAt,
    });
  }, _withRecordTransactionObservability);

  /** `PRICE_INCREASE` — Apple has scheduled a price change for the next renewal. */
  const recordPriceIncrease = Effect.fn("recordPriceIncrease")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "price_increase");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    /**
     * The next renewal date is when the new price applies; pricing fields live
     * on `renewalInfo`, not the transaction. Money falls back to the decoded
     * transaction price when renewal info is absent.
     */
    const effectiveAt = Option.flatMap(input.decodedRenewalInfo, (renewalInfo) =>
      Option.map(renewalInfo.renewalDate, (ms) => dateFromMillis(ms)),
    );
    /**
     * The next renewal date is when the new price applies; pricing fields live
     * on `renewalInfo`, not the transaction. When renewal info carries the
     * upcoming price we synthesize a money record for that price under the
     * same commission / tax rules as the inline-transaction path; otherwise
     * we fall back to the transaction's existing money breakdown.
     */
    const renewalPrice = Option.getOrUndefined(
      Option.flatMap(input.decodedRenewalInfo, (renewalInfo) => renewalInfo.renewalPrice),
    );
    const renewalCurrency = Option.getOrUndefined(
      Option.flatMap(input.decodedRenewalInfo, (renewalInfo) => renewalInfo.currency),
    );
    const resolveMoney = () => {
      if (renewalPrice !== undefined && renewalCurrency !== undefined) {
        return _moneyForRenewalPrice(
          ctx.decodedTransaction,
          ctx.globalConfiguration,
          ctx.occurredAt,
          renewalPrice,
          renewalCurrency,
        );
      }
      return Effect.succeed(ctx.money);
    };
    const money = yield* resolveMoney();
    return yield* purchaseProcessingService.recordPriceIncrease({
      ...ctx.base,
      effectiveAt,
      money,
    });
  }, _withRecordTransactionObservability);

  /** `DID_CHANGE_RENEWAL_STATUS` subtype `AUTO_RENEW_ENABLED` — customer un-canceled. */
  const recordAutoRenewResumed = Effect.fn("recordAutoRenewResumed")(function* (
    input: RecordTransactionInput,
  ) {
    const ctx = yield* _resolveAppStorePurchaseContext(input, "auto_renew_resumed");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.resumeAutoRenew({
      ...ctx.base,
      resumedAt: ctx.occurredAt,
    });
  }, _withRecordTransactionObservability);

  /**
   * Informational notifications (`REFUND_DECLINED`, `METADATA_UPDATE`,
   * `RESCIND_CONSENT`, `CONSUMPTION_REQUEST`, `EXTERNAL_PURCHASE_TOKEN`).
   * No state change in purchase-processing — the webhook handler's
   * `payment_provider_notification_processed` row is the durable record.
   * This method exists so the webhook handler has a uniform "record" target;
   * it just returns the ignored-result.
   */
  const recordInformationalNotification = Effect.fn("recordInformationalNotification")(function* (
    input: RecordTransactionInput,
  ) {
    yield* Effect.logInfo("App Store informational notification observed (no state change)", {
      providerEventType: "informational",
      source: input.source,
    });
    return makeIgnoredPurchaseProcessingResult();
  }, _withRecordTransactionObservability);

  return constant({
    ...provider,
    buildSdkContextFromConfiguration,
    recordAutoRenewResumed,
    recordBillingRetry,
    recordEntitlementRevoked,
    recordInformationalNotification,
    recordOfferRedeemed,
    recordPriceIncrease,
    recordPurchase,
    recordRefund,
    recordRefundReversed,
    recordRenewalPreferenceChange,
    recordSubscriptionCanceled,
    recordSubscriptionExpired,
    recordSubscriptionExtended,
    recordSubscriptionRenewed,
  });
})();

export type { AppStoreSdkContext };

export class AppStorePaymentProvider extends Context.Service<AppStorePaymentProvider>()(
  "@voidhash/backend/purchases/AppStorePaymentProvider",
  { make },
) {
  static readonly layer = Layer.effect(AppStorePaymentProvider)(AppStorePaymentProvider.make).pipe(
    Layer.provideMerge(AppStorePaymentProviderServiceQueries.layer),
  );
}
