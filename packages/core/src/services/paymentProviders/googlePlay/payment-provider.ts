/**
 * The Google Play purchase record engine — the provider boundary that
 * normalizes authoritative Play state into the platform-neutral
 * {@link PurchaseProcessingService} actions. Mirrors the App Store
 * `payment-provider.ts` engine: identity resolution, money construction,
 * idempotency-key derivation, and one `record*` method per lifecycle event.
 *
 * Unlike Apple's self-contained signed JWS, Google RTDN bodies are pointers,
 * so the webhook handler / SDK boundary first fetch authoritative state
 * (`subscriptions.v2.get` / `products.v2.get`) via {@link fetchAndNormalizeSubscription}
 * / {@link fetchAndNormalizeProduct} and pass a {@link GooglePlayNormalizedPurchase}
 * into the `record*` methods.
 */
import {
  type PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  type PersonOriginValue,
  type Project as DbProject,
  type ProviderEnvironmentValue,
  PersonOrigin,
  ProviderEnvironment,
} from "@voidhash/db";
import { PurchaseType } from "@voidhash/lib/constants";
import { Context, Effect, Layer, Option, Schema } from "effect";

import { constant } from "@voidhash/lib/lang";
import {
  DEFAULT_SUBSCRIPTION_TRANSFER_MODE,
  type SubscriptionTransferMode,
} from "../../../domain/paymentProvider/SubscriptionTransfer.ts";
import {
  type PurchaseActionContext,
  PurchaseProcessingService,
} from "../../purchaseProcessing/PurchaseProcessingService.ts";
import { FxRateService } from "../../fxRates/FxRateService.ts";
import { PersonIdentityService } from "../../personIdentity/PersonIdentityService.ts";
import {
  ACCOUNT_TOKEN_SERVICE_ID,
  deriveAccountToken,
} from "../../../utils/crypto/account-token.ts";
import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { generateId } from "../../../utils/index.ts";
import type { PaymentProvider } from "../payment-provider-adapter.ts";
import {
  type GooglePlayGlobalConfiguration,
  type GooglePlayProductConfiguration,
  globalConfigurationSchema,
  makeGooglePlayConfigProvider,
  productConfigurationSchema,
} from "./config-provider.ts";
import {
  GooglePlayPaymentProviderProductNotMappedError,
  GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError,
  GooglePlayPaymentProviderServiceError,
  GooglePlayPaymentProviderTransactionMissingPersonIdentifierError,
} from "./errors.ts";
import {
  type GooglePlayNormalizedPurchase,
  type GooglePlayPurchaseProcessingEventType,
  GOOGLE_PLAY_SERVICE_ID,
  buildGooglePlayWebhookAnonymousDistinctId,
  getGooglePlayPersonIdentifier,
  getGooglePlayPurchaseProcessingIdempotencyKey,
  googlePlayProviderProductKey,
  makeIgnoredPurchaseProcessingResult,
  normalizeProductPurchaseV2,
  normalizeSubscriptionPurchaseV2,
} from "./helpers.ts";
import {
  buildGooglePlayMoney,
  googleMoneyToMinorUnits,
  resolveGooglePlayCommissionRateBps,
} from "./money.ts";
import { GooglePlayPaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import {
  type GooglePlaySdkContext,
  GooglePlayServerApi,
  buildGooglePlaySdkContext,
} from "./sdk-context.ts";

// Re-export so existing importers of the schemas from this module keep working.
export { globalConfigurationSchema, productConfigurationSchema };

export interface GooglePlayPaymentProviderShape extends PaymentProvider<
  "google-play",
  GooglePlayGlobalConfiguration,
  GooglePlayProductConfiguration
> {
  readonly globalConfigurationSchema: typeof globalConfigurationSchema;
  readonly productConfigurationSchema: typeof productConfigurationSchema;
}

/**
 * Shared base accepted by every `record*` method. The webhook handler and SDK
 * boundary pre-resolve `configuration`, `project`, and the authoritative
 * `purchase` and pass them in.
 */
type GooglePlayRecordInputBase = {
  readonly configuration: DbPaymentProviderConfiguration;
  readonly project: DbProject;
  readonly purchase: GooglePlayNormalizedPurchase;
  readonly providerEnvironment: ProviderEnvironmentValue;
  /** The event's true occurrence time (RTDN `eventTimeMillis`, or SDK `receivedAt`). */
  readonly eventTime: Date;
  readonly receivedAt: Date;
  readonly notificationUUID?: string;
};

/**
 * The SDK path requires a `distinctId` so we can attach the purchase to the
 * caller's user; webhook and reconciliation paths derive identity from the
 * purchase. Encoded as a discriminated union so the requirement is a type-level
 * constraint at every call site.
 */
export type GooglePlayRecordInput = GooglePlayRecordInputBase &
  (
    | { readonly source: "sdk"; readonly distinctId: string }
    | { readonly source: "webhook" | "reconciliation"; readonly distinctId?: never }
  );

const optionAttr = <A>(value: Option.Option<A>): A | undefined => Option.getOrUndefined(value);

const crossOwnerTransferOutcome = (transferred: boolean): string => {
  if (transferred) return "cross_owner_transfer";
  return "cross_owner_transfer_failed";
};

/** Only the SDK path carries a caller-supplied distinct id. */
const sdkDistinctId = (input: GooglePlayRecordInput): string | undefined => {
  if (input.source === "sdk") return input.distinctId;
  return undefined;
};

const subscriptionIdOption = (
  purchase: GooglePlayNormalizedPurchase,
): Option.Option<string> => {
  if (purchase.kind === "subscription") return Option.some(purchase.purchaseToken);
  return Option.none<string>();
};

const purchaseEventType = (isSubscription: boolean): GooglePlayPurchaseProcessingEventType => {
  if (isSubscription) return "purchase";
  return "one_time_purchase";
};

const make = Effect.gen(function* () {
  const queries = yield* GooglePlayPaymentProviderServiceQueries;
  const personIdentityService = yield* PersonIdentityService;
  const purchaseProcessingService = yield* PurchaseProcessingService;
  const googlePlayServerApi = yield* GooglePlayServerApi;
  /** Captured at construction so `record*` methods keep `R = never` (no FX requirement leaks). */
  const fxRateService = yield* FxRateService;
  const secretCrypto = yield* PaymentConfigSecretCrypto;

  const configProvider = makeGooglePlayConfigProvider(secretCrypto);
  const provider = {
    ...configProvider,
    globalConfigurationSchema,
    productConfigurationSchema,
  } satisfies GooglePlayPaymentProviderShape;

  /**
   * Builds the per-tenant Play API context from a stored configuration row:
   * decodes the config schema, decrypts the service-account JSON, and mints the
   * client. Rows written before the encryption seam are plaintext and pass
   * through.
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
    const serviceAccountKey = yield* secretCrypto.decrypt(parsed.serviceAccountKey);
    return yield* buildGooglePlaySdkContext(googlePlayServerApi, {
      packageName: parsed.packageName,
      serviceAccountKey,
    });
  });

  const providerEnvironmentForTest = (isTestPurchase: boolean): ProviderEnvironmentValue => {
    if (isTestPurchase) return ProviderEnvironment.Sandbox;
    return ProviderEnvironment.Production;
  };

  /**
   * Fetches authoritative subscription state for a `purchaseToken`, resolves
   * the buyer's regional list price from the catalog, and returns the
   * normalized purchase plus the detected environment.
   */
  const fetchAndNormalizeSubscription = Effect.fn("fetchAndNormalizeSubscription")(function* (
    sdkContext: GooglePlaySdkContext,
    input: { readonly purchaseToken: string; readonly subscriptionId: string },
  ) {
    const data = yield* sdkContext.getSubscriptionV2(input.purchaseToken);
    const lineItem = data.lineItems?.[0];
    const productId = lineItem?.productId ?? input.subscriptionId;
    const basePlanId = Option.fromNullishOr(lineItem?.offerDetails?.basePlanId);
    const priceMoney = yield* sdkContext.resolveSubscriptionRegionalPrice({
      basePlanId,
      productId,
      regionCode: Option.fromNullishOr(data.regionCode),
    });
    const minorUnits = Option.flatMap(priceMoney, googleMoneyToMinorUnits);
    const purchase = normalizeSubscriptionPurchaseV2({
      currency: Option.map(minorUnits, (value) => value.currency),
      data,
      priceMinorUnits: Option.map(minorUnits, (value) => value.minorUnits),
      purchaseToken: input.purchaseToken,
      subscriptionId: input.subscriptionId,
    });
    return {
      providerEnvironment: providerEnvironmentForTest(data.testPurchase !== undefined),
      purchase,
    };
  });

  /**
   * Fetches authoritative one-time product state for a `purchaseToken`. Google
   * exposes no catalog-typed regional price for one-time products, so money is
   * omitted (the entitlement is still recorded).
   */
  const fetchAndNormalizeProduct = Effect.fn("fetchAndNormalizeProduct")(function* (
    sdkContext: GooglePlaySdkContext,
    input: { readonly purchaseToken: string; readonly sku: string },
  ) {
    const data = yield* sdkContext.getProductV2(input.purchaseToken);
    const purchase = normalizeProductPurchaseV2({
      currency: Option.none(),
      data,
      priceMinorUnits: Option.none(),
      purchaseToken: input.purchaseToken,
      sku: input.sku,
    });
    return {
      providerEnvironment: providerEnvironmentForTest(data.testPurchaseContext !== undefined),
      purchase,
    };
  });

  const _resolveDistinctIdToPersonId = Effect.fn("_resolveDistinctIdToPersonId")(function* (input: {
    readonly distinctId: string;
    readonly eventTimestamp: Date;
    readonly projectId: string;
    readonly origin?: PersonOriginValue;
  }) {
    const result = yield* personIdentityService.resolveDistinctId({
      distinctId: input.distinctId,
      eventTimestamp: input.eventTimestamp,
      origin: input.origin ?? PersonOrigin.Android,
      projectId: input.projectId,
      setAttributes: {},
      setOnceAttributes: {},
      shouldCreatePerson: true,
    });
    if (!result.identity.personId) {
      return yield* Effect.fail(
        new GooglePlayPaymentProviderServiceError({
          cause: "Google Play transaction resolved without person id",
        }),
      );
    }
    return result.identity.personId;
  });

  const _resolvePersonForGooglePlayTransaction = Effect.fn(
    "_resolvePersonForGooglePlayTransaction",
  )(function* (input: {
    readonly projectId: string;
    readonly organizationId: string;
    readonly paymentProviderConfigurationId: string;
    readonly source: "sdk" | "webhook" | "reconciliation";
    readonly distinctId?: string;
    readonly obfuscatedExternalAccountId?: string;
    readonly providerTransactionId: string;
    readonly providerSubscriptionId?: string;
    readonly personIdentifier: string;
    readonly providerEnvironment: ProviderEnvironmentValue;
    readonly transferMode: SubscriptionTransferMode;
    readonly occurredAt: Date;
  }) {
    // The SDK sets a lowercase hyphenated UUIDv5 account token; canonicalize
    // defensively before any lookup or comparison.
    const accountToken = input.obfuscatedExternalAccountId?.toLowerCase();
    yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
    yield* Effect.annotateCurrentSpan("voidhash.purchase.source", input.source);

    if (input.source === "sdk") {
      if (!input.distinctId) {
        return yield* new GooglePlayPaymentProviderSdkTransactionMissingDistinctIdError({
          purchaseToken: input.providerSubscriptionId ?? input.providerTransactionId,
        });
      }
      const sdkPersonId = yield* _resolveDistinctIdToPersonId({
        distinctId: input.distinctId,
        eventTimestamp: input.occurredAt,
        projectId: input.projectId,
      });

      const existingExternal = yield* queries.findExternalIdentifier({
        identifier: input.personIdentifier,
        projectId: input.projectId,
        serviceId: GOOGLE_PLAY_SERVICE_ID,
      });

      if (Option.isSome(existingExternal)) {
        if (existingExternal.value.personId !== sdkPersonId) {
          const previousIsWebhookStandIn = yield* queries.isGooglePlayWebhookStandInPerson({
            personId: existingExternal.value.personId,
            projectId: input.projectId,
          });

          if (previousIsWebhookStandIn) {
            yield* Effect.annotateCurrentSpan({
              "google_play.identity_result": "webhook_stand_in_merge",
            });
            const previousDistinctId = yield* queries.findDistinctIdForPerson({
              personId: existingExternal.value.personId,
              projectId: input.projectId,
            });
            if (Option.isSome(previousDistinctId)) {
              yield* personIdentityService
                .identifyDistinctId({
                  distinctId: input.distinctId,
                  eventTimestamp: input.occurredAt,
                  origin: PersonOrigin.Android,
                  previousDistinctId: previousDistinctId.value,
                  projectId: input.projectId,
                  setAttributes: {},
                  setOnceAttributes: {},
                })
                .pipe(
                  Effect.catch((error: unknown) =>
                    Effect.logWarning(
                      "Google Play SDK identity rebind: identifyDistinctId merge failed; continuing with identifier rebind only",
                      { cause: error, personIdentifier: input.personIdentifier },
                    ),
                  ),
                );
            }
            yield* queries.rebindExternalIdentifier({
              id: existingExternal.value.id,
              newPersonId: sdkPersonId,
            });
          } else {
            // Cross-owner restore between two real persons: transfer the
            // entitlement FIRST and rebind LAST so a crash between is
            // self-healing.
            const transferred = yield* Effect.gen(function* () {
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
                  providerId: "google-play",
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
                  providerId: "google-play",
                  purchaseId: purchase.value.id,
                  source: "sdk",
                  toPersonId: sdkPersonId,
                  transferMode: input.transferMode,
                  triggerReason: "appstore_restore",
                });
              }
              return true;
            }).pipe(
              Effect.catch((error: unknown) =>
                Effect.logWarning(
                  "Google Play cross-owner transfer failed; skipping identifier rebind so a later delivery retries",
                  { cause: error, personIdentifier: input.personIdentifier },
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
              "google_play.identity_result": crossOwnerTransferOutcome(transferred),
            });
          }
        } else {
          yield* Effect.annotateCurrentSpan({ "google_play.identity_result": "same_person" });
        }
      } else {
        yield* Effect.annotateCurrentSpan({
          "google_play.identity_result": "new_external_identifier",
        });
        yield* queries.createExternalIdentifier({
          id: generateId("personDistinctId"),
          identifier: input.personIdentifier,
          isDefault: true,
          personId: sdkPersonId,
          projectId: input.projectId,
          serviceId: GOOGLE_PLAY_SERVICE_ID,
        });
      }

      // Lazily backfill the account-token binding, but ONLY when the purchase's
      // token actually derives from THIS person's distinctId — on a cross-owner
      // restore the token belongs to the original buyer.
      if (accountToken) {
        const expectedToken = yield* deriveAccountToken(input.distinctId);
        if (accountToken === expectedToken) {
          yield* queries.upsertExternalIdentifier({
            id: generateId("personDistinctId"),
            identifier: accountToken,
            isDefault: true,
            personId: sdkPersonId,
            projectId: input.projectId,
            serviceId: ACCOUNT_TOKEN_SERVICE_ID,
          });
        }
      }

      return { personId: sdkPersonId };
    }

    // Existing `google-play` binding (keyed on purchaseToken / orderId, or the
    // account token itself). Checked BEFORE the account-token binding because it
    // reflects cross-owner transfers that the per-user token binding deliberately
    // does NOT (mirrors the App Store ordering). Person merges do not repoint
    // provider identifiers, so canonicalize the result to avoid resolving a
    // post-merge event to the archived source person.
    const externalIdentifier = yield* queries.findExternalIdentifier({
      identifier: input.personIdentifier,
      projectId: input.projectId,
      serviceId: GOOGLE_PLAY_SERVICE_ID,
    });
    if (Option.isSome(externalIdentifier)) {
      yield* Effect.annotateCurrentSpan({ "google_play.identity_result": "external_identifier" });
      return {
        personId: yield* queries.resolveCanonicalPersonId({
          personId: externalIdentifier.value.personId,
        }),
      };
    }

    // Pre-registered account-token binding (written at identity create/identify) —
    // the instant-resolution path for a user's first-ever webhook before any SDK
    // sync has bound the series.
    if (accountToken) {
      const tokenBinding = yield* queries.findExternalIdentifier({
        identifier: accountToken,
        projectId: input.projectId,
        serviceId: ACCOUNT_TOKEN_SERVICE_ID,
      });
      if (Option.isSome(tokenBinding)) {
        yield* Effect.annotateCurrentSpan({
          "google_play.identity_result": "account_token_binding",
        });
        return {
          personId: yield* queries.resolveCanonicalPersonId({
            personId: tokenBinding.value.personId,
          }),
        };
      }
    }

    const anonymousDistinctId = buildGooglePlayWebhookAnonymousDistinctId({
      personIdentifier: input.personIdentifier,
      providerEnvironment: input.providerEnvironment,
    });
    const personId = yield* _resolveDistinctIdToPersonId({
      distinctId: anonymousDistinctId,
      eventTimestamp: input.occurredAt,
      origin: PersonOrigin.GooglePlayWebhook,
      projectId: input.projectId,
    });
    yield* queries.createExternalIdentifier({
      id: generateId("personDistinctId"),
      identifier: input.personIdentifier,
      isDefault: true,
      personId,
      projectId: input.projectId,
      serviceId: GOOGLE_PLAY_SERVICE_ID,
    });
    yield* Effect.annotateCurrentSpan({ "google_play.identity_result": "webhook_stand_in" });
    return { personId };
  });

  const _money = (purchase: GooglePlayNormalizedPurchase, occurredAt: Date) =>
    buildGooglePlayMoney({
      commissionRateBps: resolveGooglePlayCommissionRateBps({ productType: purchase.kind }),
      currency: purchase.currency,
      fxRateService,
      isTrial: purchase.isTrial,
      occurredAt,
      priceMinorUnits: purchase.priceMinorUnits,
      storefront: purchase.storefront,
    });

  /**
   * Shared resolution for every `record*` method: identifiers, person, product
   * mapping, money, and the `PurchaseActionContext` base. Returns `"ignored"`
   * for Play-valid payloads we cannot map (no productId).
   */
  const _resolveContext = (
    input: GooglePlayRecordInput,
    providerEventType: GooglePlayPurchaseProcessingEventType,
  ) =>
    Effect.gen(function* () {
      const purchase = input.purchase;
      yield* Effect.annotateCurrentSpan("voidhash.payment_provider.event_type", providerEventType);
      yield* Effect.annotateCurrentSpan(
        "voidhash.payment_provider.configuration_id",
        input.configuration.id,
      );

      // Play-valid payload without a usable productId (e.g. a voided
      // notification whose fetched purchase lacks a line item). Caller
      // short-circuits with an idempotent no-op.
      if (!purchase.productId) {
        return constant({ kind: "ignored" });
      }

      const providerTransactionId = Option.getOrElse(
        purchase.orderId,
        () => purchase.purchaseToken,
      );
      const providerSubscriptionId = subscriptionIdOption(purchase);
      const occurredAt = input.eventTime;

      const personIdentifierOp = getGooglePlayPersonIdentifier(purchase);
      if (input.source !== "sdk" && Option.isNone(personIdentifierOp)) {
        return yield* new GooglePlayPaymentProviderTransactionMissingPersonIdentifierError({
          purchaseToken: purchase.purchaseToken,
        });
      }

      const resolvedPerson = yield* _resolvePersonForGooglePlayTransaction({
        distinctId: sdkDistinctId(input),
        obfuscatedExternalAccountId: optionAttr(purchase.obfuscatedExternalAccountId),
        occurredAt,
        organizationId: input.project.organizationId,
        paymentProviderConfigurationId: input.configuration.id,
        personIdentifier: Option.getOrElse(personIdentifierOp, () => providerTransactionId),
        projectId: input.project.id,
        providerEnvironment: input.providerEnvironment,
        providerSubscriptionId: optionAttr(providerSubscriptionId),
        providerTransactionId,
        source: input.source,
        // Google Play has no per-tenant transfer-mode config field today; use
        // the platform default (transfer to the new owner on restore).
        transferMode: DEFAULT_SUBSCRIPTION_TRANSFER_MODE,
      });
      yield* Effect.annotateCurrentSpan("voidhash.person.id", resolvedPerson.personId);

      // Try the full `productId:basePlanId` key first, then the bare productId —
      // the merchant may have mapped either.
      const fullKey = googlePlayProviderProductKey(purchase.productId, purchase.basePlanId);
      const providerProduct =
        (yield* queries.findPaymentProviderConfigurationProductByPrimaryKey({
          paymentProviderConfigurationId: input.configuration.id,
          providerProductKey: fullKey,
        })) ??
        (yield* Effect.gen(function* () {
          if (fullKey === purchase.productId) return undefined;
          return yield* queries.findPaymentProviderConfigurationProductByPrimaryKey({
            paymentProviderConfigurationId: input.configuration.id,
            providerProductKey: purchase.productId,
          });
        }));
      if (!providerProduct) {
        return yield* new GooglePlayPaymentProviderProductNotMappedError({
          paymentProviderConfigurationId: input.configuration.id,
          providerProductKey: fullKey,
        });
      }
      yield* Effect.annotateCurrentSpan("voidhash.product.id", providerProduct.productId);

      const idempotencyKey = yield* getGooglePlayPurchaseProcessingIdempotencyKey({
        eventType: providerEventType,
        purchase,
      });
      yield* Effect.annotateCurrentSpan("voidhash.purchase.idempotency_key", idempotencyKey);

      const money = yield* _money(purchase, occurredAt);

      const base: PurchaseActionContext = {
        idempotencyKey,
        occurredAt,
        organizationId: input.project.organizationId,
        paymentProviderConfigurationId: input.configuration.id,
        paymentProviderConfigurationProductId: providerProduct.id,
        personId: resolvedPerson.personId,
        projectId: input.project.id,
        providerEnvironment: input.providerEnvironment,
        providerEventType,
        providerId: constant("google-play"),
        providerSubscriptionId,
        providerTransactionId: Option.some(providerTransactionId),
        providerWebhookNotificationId: Option.fromNullishOr(input.notificationUUID),
        rawProviderPayload: Option.some(purchase),
        receivedAt: input.receivedAt,
        source: input.source,
      };

      return { base, kind: constant("resolved"), money, occurredAt, purchase };
    });

  /**
   * Records a new Google Play purchase — a subscription initial buy (RTDN
   * `SUBSCRIPTION_PURCHASED`) or a one-time product purchase
   * (`ONE_TIME_PRODUCT_PURCHASED`), plus the SDK path. Routes to
   * `startSubscription` or `completeOneTimePurchase`.
   */
  const recordPurchase = Effect.fn("recordPurchase")(function* (input: GooglePlayRecordInput) {
    const isSubscription = input.purchase.kind === "subscription";
    const ctx = yield* _resolveContext(input, purchaseEventType(isSubscription));
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    if (isSubscription) {
      return yield* purchaseProcessingService.startSubscription({
        ...ctx.base,
        expiresAt: ctx.purchase.expiryTime,
        isTrial: ctx.purchase.isTrial,
        money: ctx.money,
        purchasedAt: ctx.occurredAt,
        startsAt: Option.getOrElse(ctx.purchase.startTime, () => ctx.occurredAt),
      });
    }
    return yield* purchaseProcessingService.completeOneTimePurchase({
      ...ctx.base,
      money: ctx.money,
      purchaseType: "one-time",
      purchasedAt: ctx.occurredAt,
    });
  });

  /** RTDN `SUBSCRIPTION_RENEWED` / `SUBSCRIPTION_RECOVERED` — a successful renewal charge. */
  const recordSubscriptionRenewed = Effect.fn("recordSubscriptionRenewed")(function* (
    input: GooglePlayRecordInput,
  ) {
    // A renewal is always a real billed period. The line-item `offerId` (which
    // drives `isTrial` in normalization) persists for the LIFE of the
    // subscription — it is not a per-period free/paid flag — so it must NOT
    // suppress renewal revenue. Force isTrial=false here so the base-plan price
    // flows into the renewal event (mirrors the App Store, where renewals key
    // isTrial off the per-transaction offerDiscountType, not a persistent id).
    const ctx = yield* _resolveContext(
      { ...input, purchase: { ...input.purchase, isTrial: false } },
      "renewal",
    );
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.renewSubscription({
      ...ctx.base,
      expiresAt: ctx.purchase.expiryTime,
      isTrial: ctx.purchase.isTrial,
      money: ctx.money,
      renewedAt: ctx.occurredAt,
      startsAt: Option.getOrElse(ctx.purchase.startTime, () => ctx.occurredAt),
    });
  });

  /** RTDN `SUBSCRIPTION_CANCELED` — user/system disabled auto-renew; entitled until expiry. */
  const recordSubscriptionCanceled = Effect.fn("recordSubscriptionCanceled")(function* (
    input: GooglePlayRecordInput,
  ) {
    const ctx = yield* _resolveContext(input, "canceled");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.cancelSubscription({
      ...ctx.base,
      cancelAtPeriodEnd: true,
      canceledAt: ctx.occurredAt,
      cancellationReason: Option.none(),
    });
  });

  /** RTDN `SUBSCRIPTION_EXPIRED` — the subscription ended without further renewal. */
  const recordSubscriptionExpired = Effect.fn("recordSubscriptionExpired")(function* (
    input: GooglePlayRecordInput,
  ) {
    const ctx = yield* _resolveContext(input, "expired");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.expireSubscription({
      ...ctx.base,
      expiredAt: Option.getOrElse(ctx.purchase.expiryTime, () => ctx.occurredAt),
    });
  });

  /** RTDN `SUBSCRIPTION_IN_GRACE_PERIOD` / `SUBSCRIPTION_ON_HOLD` — billing retry; stays Active during grace. */
  const recordBillingRetry = Effect.fn("recordBillingRetry")(function* (
    input: GooglePlayRecordInput,
  ) {
    const ctx = yield* _resolveContext(input, "billing_retry");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.enterBillingRetry({
      ...ctx.base,
      billingRetryAt: ctx.occurredAt,
      gracePeriodExpiresAt: ctx.purchase.expiryTime,
    });
  });

  /** RTDN `SUBSCRIPTION_DEFERRED` — the renewal date was pushed out. */
  const recordSubscriptionExtended = Effect.fn("recordSubscriptionExtended")(function* (
    input: GooglePlayRecordInput,
  ) {
    const ctx = yield* _resolveContext(input, "extended");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    if (Option.isNone(ctx.purchase.expiryTime)) {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.extendSubscription({
      ...ctx.base,
      extendedTo: ctx.purchase.expiryTime.value,
    });
  });

  /** RTDN `SUBSCRIPTION_PRICE_CHANGE_CONFIRMED` — a price change applies next renewal. */
  const recordPriceIncrease = Effect.fn("recordPriceIncrease")(function* (
    input: GooglePlayRecordInput,
  ) {
    const ctx = yield* _resolveContext(input, "price_increase");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.recordPriceIncrease({
      ...ctx.base,
      effectiveAt: ctx.purchase.expiryTime,
      money: ctx.money,
    });
  });

  /** RTDN `SUBSCRIPTION_RESTARTED` — user re-enabled auto-renew before expiry. */
  const recordAutoRenewResumed = Effect.fn("recordAutoRenewResumed")(function* (
    input: GooglePlayRecordInput,
  ) {
    const ctx = yield* _resolveContext(input, "auto_renew_resumed");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.resumeAutoRenew({
      ...ctx.base,
      resumedAt: ctx.occurredAt,
    });
  });

  /** Voided purchase (refund) — a transaction was refunded. */
  const recordRefund = Effect.fn("recordRefund")(function* (input: GooglePlayRecordInput) {
    const ctx = yield* _resolveContext(input, "refund");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    return yield* purchaseProcessingService.refundPurchase({
      ...ctx.base,
      refundReason: Option.none(),
      refundedAt: ctx.occurredAt,
    });
  });

  /** RTDN `SUBSCRIPTION_REVOKED` / voided revoke — entitlement revoked immediately. */
  const recordEntitlementRevoked = Effect.fn("recordEntitlementRevoked")(function* (
    input: GooglePlayRecordInput,
  ) {
    const ctx = yield* _resolveContext(input, "revoke");
    if (ctx.kind === "ignored") {
      return makeIgnoredPurchaseProcessingResult();
    }
    if (ctx.purchase.kind !== "subscription") {
      return yield* purchaseProcessingService.revokePurchase({
        ...ctx.base,
        revocationReason: Option.none(),
        revokedAt: ctx.occurredAt,
      });
    }
    return yield* purchaseProcessingService.revokeSubscription({
      ...ctx.base,
      revocationReason: Option.none(),
      revokedAt: ctx.occurredAt,
    });
  });

  /**
   * Informational notifications with no purchase-state change (e.g.
   * `SUBSCRIPTION_PAUSED` / `PAUSE_SCHEDULE_CHANGED`, test notifications). The
   * webhook handler's notification-ledger row is the durable record.
   */
  const recordInformationalNotification = Effect.fn("recordInformationalNotification")(function* (
    input: GooglePlayRecordInput,
  ) {
    yield* Effect.logInfo("Google Play informational notification observed (no state change)", {
      source: input.source,
    });
    return makeIgnoredPurchaseProcessingResult();
  });

  return constant({
    ...provider,
    buildSdkContextFromConfiguration,
    fetchAndNormalizeProduct,
    fetchAndNormalizeSubscription,
    recordAutoRenewResumed,
    recordBillingRetry,
    recordEntitlementRevoked,
    recordInformationalNotification,
    recordPriceIncrease,
    recordPurchase,
    recordRefund,
    recordSubscriptionCanceled,
    recordSubscriptionExpired,
    recordSubscriptionExtended,
    recordSubscriptionRenewed,
  });
});

export type { GooglePlaySdkContext };

export class GooglePlayPaymentProvider extends Context.Service<GooglePlayPaymentProvider>()(
  "core/GooglePlayPaymentProvider",
  { make },
) {
  static readonly layer = Layer.effect(GooglePlayPaymentProvider)(
    GooglePlayPaymentProvider.make,
  ).pipe(Layer.provideMerge(GooglePlayPaymentProviderServiceQueries.layer));
}
