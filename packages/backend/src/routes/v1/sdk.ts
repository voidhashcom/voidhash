import {
  RegisterDeviceResponse,
  SdkCurrentSubscription,
  SdkEntitlementGrant,
  SdkFeatureFlagResult,
  SdkFeatureFlagsResponse,
  SdkHeaders,
  SdkPerson,
  SdkPurchaseHistoryEntry,
  SdkResolvedPaywall,
  SdkResolvedPaywallShowing,
  SdkSchema,
  SdkSchemaLocation,
  SdkSchemaPerk,
  SdkSchemaProduct,
  SdkSubscriptionHistoryEntry,
  SdkSyncTransactionResponse,
  SdkDevelopmentPurchaseResponse,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiAuthenticationError,
  ApiPushDeviceNotFoundError,
  ApiPushDeviceServiceError,
  ApiPushDeviceValidationError,
  ApiSchemaServiceError,
  ApiSdkPersonAlreadyIdentifiedError,
  ApiSdkPersonNotFoundError,
  ApiSdkServiceError,
  ApiSdkValidationError,
} from "@voidhash/api-contracts/errors";
import type { AuthenticationError } from "@voidhash/core/domain/auth/Auth";
import type {
  SdkPersonSnapshot,
  SdkValidationError,
} from "@voidhash/core/domain/sdkPerson/SdkPerson";
import {
  FeatureFlagService,
  DevelopmentPaymentProviderService,
  InternalFeatureFlagService,
  NotificationTokenService,
  PaywallLocationService,
  PersonIdentityService,
  SchemaService,
  SdkService,
  type SdkServiceError,
} from "@voidhash/core/services";
import { getDevelopmentPrice } from "@voidhash/core/services/paymentProviders/development/pricing";
import { Db } from "@voidhash/db";
import type { ProductTypeValue, SubscriptionDurationValue } from "@voidhash/lib";
import { AuthSession, INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { constant } from "@voidhash/lib/lang";
import { DateTime, Effect, Option, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, getPersonMetadataFromSdkHeaders } from "../../ApiMiddlewares.ts";
import { schemaNotModifiedResponse, schemaResponseHeaders } from "./schema.ts";

const toSdkCurrentSubscription = (current: SdkPersonSnapshot["subscriptions"]["current"]) => {
  if (!current) return null;
  return new SdkCurrentSubscription({
    expiresAt: current.expiresAt,
    productId: current.productId,
    status: current.status,
    subscriptionId: current.subscriptionId,
  });
};

/** Copies an optional record payload, keeping "absent" distinct from "empty". */
const optionalRecordCopy = <T extends object>(value: T | null | undefined): T | undefined => {
  if (!value) return undefined;
  return { ...value };
};

/** Copies an optional readonly list into the mutable shape the services expect. */
const optionalListCopy = <T>(value: ReadonlyArray<T> | null | undefined): T[] | undefined => {
  if (!value) return undefined;
  return [...value];
};

const optionalClientEventId = (
  clientEventId: string | null | undefined,
): { clientEventId?: string } => {
  if (!clientEventId) return {};
  return { clientEventId };
};

const asProductType = (value: any): ProductTypeValue => value;
const asSubscriptionDuration = (value: any): SubscriptionDurationValue | null => value;

const toSdkPerson = (snapshot: SdkPersonSnapshot) =>
  new SdkPerson({
    distinctId: snapshot.distinctId,
    email: snapshot.email,
    entitlements: {
      grants: snapshot.entitlements.grants.map(
        (grant) =>
          new SdkEntitlementGrant({
            expiresAt: grant.expiresAt,
            perkId: grant.perkId,
            source: grant.source,
            sourceId: grant.sourceId,
            sourcePersonId: grant.sourcePersonId,
            status: grant.status,
          }),
      ),
    },
    name: snapshot.name,
    personId: snapshot.personId,
    purchases: {
      history: snapshot.purchases.history.map(
        (purchase) =>
          new SdkPurchaseHistoryEntry({
            createdAt: purchase.createdAt,
            productId: purchase.productId,
            providerKey: purchase.providerKey,
            purchaseId: purchase.purchaseId,
            sourcePersonId: purchase.sourcePersonId,
            type: purchase.type,
          }),
      ),
    },
    snapshotContext: {
      includedPersonIds: snapshot.snapshotContext.includedPersonIds,
      migrationJobId: snapshot.snapshotContext.migrationJobId,
      mode: snapshot.snapshotContext.mode,
    },
    subscriptions: {
      current: toSdkCurrentSubscription(snapshot.subscriptions.current),
      history: snapshot.subscriptions.history.map(
        (entry) =>
          new SdkSubscriptionHistoryEntry({
            canceledAt: entry.canceledAt,
            expiresAt: entry.expiresAt,
            isTrial: entry.isTrial,
            productId: entry.productId,
            sourcePersonId: entry.sourcePersonId,
            startsAt: entry.startsAt,
            status: entry.status,
            subscriptionId: entry.subscriptionId,
          }),
      ),
    },
  });

/** Maps the public SDK transaction payload to the provider-specific service input. */
export const mapSdkTransactionSubmission = (
  payload: {
    readonly platform: "ios" | "android";
    readonly providerProductId?: string;
    readonly productSlug: string;
    readonly purchaseToken?: string;
    readonly transactionId: string;
  },
  clientBundleId: string,
) => {
  if (payload.platform === "android") {
    return {
      packageName: clientBundleId,
      productId: payload.providerProductId ?? payload.productSlug,
      providerId: constant("google-play"),
      purchaseToken: payload.purchaseToken,
    };
  }
  return {
    bundleId: clientBundleId,
    providerId: constant("apple-app-store"),
    transactionId: payload.transactionId,
  };
};

/** Returns whether an SDK request is allowed to write development purchase data. */
export const isDevelopmentPurchaseRequest = (headers: {
  readonly "x-environment"?: "production" | "development" | "all";
  readonly "x-is-debug-build": "true" | "false";
}) => headers["x-environment"] === "development" && headers["x-is-debug-build"] === "true";

export const SdkGroupLive = HttpApiBuilder.group(VoidhashV1Api, "sdk", (handlers) =>
  Effect.gen(function* () {
    const sdkService = yield* SdkService;
    const developmentPaymentProviderService = yield* DevelopmentPaymentProviderService;
    const featureFlagService = yield* FeatureFlagService;
    const paywallLocationService = yield* PaywallLocationService;
    const schemaService = yield* SchemaService;
    const dbService = yield* Db;
    const personIdentityService = yield* PersonIdentityService;
    const notificationTokenService = yield* NotificationTokenService;
    const internalFeatureFlagService = yield* InternalFeatureFlagService;

    const requireNotificationsEnabled = (organizationId: string) =>
      internalFeatureFlagService
        .isEnabled(organizationId, INTERNAL_FEATURE_FLAGS.notifications.key)
        .pipe(
          Effect.catchTag("InternalFeatureFlagServiceError", (error) =>
            Effect.fail(new ApiPushDeviceServiceError({ cause: error.message })),
          ),
          Effect.filterOrFail(
            (enabled) => enabled,
            () =>
              new ApiActionForbiddenError({
                message: "Notifications are not enabled for this organization",
              }),
          ),
        );

    return handlers
      .handle("getPerson", () =>
        bridgeAuthSession(sdkService.getPerson().pipe(Effect.map(toSdkPerson))).pipe(
          Effect.catchTags({
            AuthenticationError: (e) =>
              Effect.fail(new ApiAuthenticationError({ cause: e.cause, message: e.message })),
            SdkPersonNotFoundError: (e) =>
              Effect.fail(new ApiSdkPersonNotFoundError({ message: e.message })),
            SdkServiceError: (e) => Effect.fail(new ApiSdkServiceError({ cause: e.cause })),
            SdkValidationError: (e) =>
              Effect.fail(new ApiSdkValidationError({ message: e.message })),
          }),
        ),
      )
      .handle("identifyPerson", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const project = session?.projects[0];
            if (!project) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No project associated with this SDK authentication session",
                  message: "No project associated with this SDK authentication session",
                }),
              );
            }

            if (!session?.person?.distinctId) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No SDK person identity found in this authentication session",
                  message: "No SDK person identity found in this authentication session",
                }),
              );
            }

            const snapshot = yield* sdkService.identifyPerson({
              distinctId: payload.distinctId,
              email: payload.email ?? null,
              name: payload.name ?? null,
              traits: optionalRecordCopy(payload.traits),
            });

            return toSdkPerson(snapshot);
          }),
        ).pipe(
          Effect.catchTags({
            AuthenticationError: (e) =>
              Effect.fail(new ApiAuthenticationError({ cause: e.cause, message: e.message })),
            SdkPersonAlreadyIdentifiedError: (e) =>
              Effect.fail(new ApiSdkPersonAlreadyIdentifiedError({ distinctId: e.distinctId })),
            SdkPersonNotFoundError: (e) =>
              Effect.fail(new ApiSdkPersonNotFoundError({ message: e.message })),
            SdkValidationError: (e) =>
              Effect.fail(new ApiSdkValidationError({ message: e.message })),
            SdkServiceError: (e) => Effect.fail(new ApiSdkServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("syncPersonAttributes", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const parsedHeaders = yield* Schema.decodeUnknownEffect(SdkHeaders)(req.headers).pipe(
              Effect.mapError((error) => new ApiSdkValidationError({ message: error.message })),
            );
            const personMetadata = getPersonMetadataFromSdkHeaders(parsedHeaders);

            const result = yield* sdkService.syncPersonAttributes({
              personMetadata,
              email: payload.email,
              name: payload.name,
              traits: optionalRecordCopy(payload.traits),
              setOnce: optionalRecordCopy(payload.setOnce),
              ...optionalClientEventId(payload.clientEventId),
            });
            return toSdkPerson(result.snapshot);
          }),
        ).pipe(
          Effect.catchTags({
            AuthenticationError: (e) =>
              Effect.fail(new ApiAuthenticationError({ cause: e.cause, message: e.message })),
            SdkPersonNotFoundError: (e) =>
              Effect.fail(new ApiSdkPersonNotFoundError({ message: e.message })),
            SdkServiceError: (e) => Effect.fail(new ApiSdkServiceError({ cause: e.cause })),
            SdkValidationError: (e) =>
              Effect.fail(new ApiSdkValidationError({ message: e.message })),
          }),
        ),
      )
      .handle("syncTransaction", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const parsedHeaders = yield* Schema.decodeUnknownEffect(SdkHeaders)(req.headers).pipe(
              Effect.mapError((error) => new ApiSdkValidationError({ message: error.message })),
            );
            // The Android package name equals the client bundle id.
            const clientBundleId = parsedHeaders["x-client-bundle-id"];

            // `submitPurchaseTransaction`'s `Effect.fn` wrapper widens the error
            // channel AND surfaces the per-provider payment services in `R`.
            // Those services are supplied by the backend layer graph, but the
            // inferred requirement would otherwise escape into the worker's
            // fetch handler; pin it to a concrete `Effect` so the outer
            // `catchTags` matches the underlying tags and `R` stays `never`.
            // oxlint-disable-next-line effect/noAs -- see the comment above: `satisfies` cannot narrow `R` back to `never`, and the pin is exactly what keeps the payment services from escaping into the worker's fetch handler.
            yield* sdkService.submitPurchaseTransaction(
              mapSdkTransactionSubmission(payload, clientBundleId),
            ) as Effect.Effect<
              unknown,
              AuthenticationError | SdkValidationError | SdkServiceError,
              never
            >;

            return new SdkSyncTransactionResponse({ accepted: true });
          }),
        ).pipe(
          Effect.catchTags({
            AuthenticationError: (e) =>
              Effect.fail(new ApiAuthenticationError({ cause: e.cause, message: e.message })),
            SdkServiceError: (e) => Effect.fail(new ApiSdkServiceError({ cause: e.cause })),
            SdkValidationError: (e) =>
              Effect.fail(new ApiSdkValidationError({ message: e.message })),
          }),
        ),
      )
      .handle("developmentPurchase", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const req = yield* HttpServerRequest.HttpServerRequest;
            const parsedHeaders = yield* Schema.decodeUnknownEffect(SdkHeaders)(req.headers).pipe(
              Effect.mapError((error) => new ApiSdkValidationError({ message: error.message })),
            );
            if (!isDevelopmentPurchaseRequest(parsedHeaders)) {
              return yield* Effect.fail(
                new ApiSdkValidationError({
                  message:
                    "Development purchases require development environment and a debug build",
                }),
              );
            }
            const session = yield* AuthSession;
            const projectId = session?.projects[0]?.id;
            const distinctId = session?.person?.distinctId;
            if (!projectId || !distinctId) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "Missing SDK project or person identity",
                  message: "Missing SDK project or person identity",
                }),
              );
            }
            const parsedPurchaseDate = DateTime.make(payload.purchaseDate);
            if (Option.isNone(parsedPurchaseDate)) {
              return yield* Effect.fail(
                new ApiSdkValidationError({ message: "Invalid purchase date" }),
              );
            }
            const purchaseDate = DateTime.toDateUtc(parsedPurchaseDate.value);
            const result = yield* developmentPaymentProviderService.processSdkPurchase({
              devTransactionId: payload.devTransactionId,
              distinctId,
              productSlug: payload.productSlug,
              projectId,
              purchaseDate,
              quantity: payload.quantity,
            });
            return new SdkDevelopmentPurchaseResponse({
              accepted: true,
              warning: result.warning,
            });
          }),
        ).pipe(
          Effect.catchTags({
            DevelopmentPaymentProviderServiceError: (error) =>
              Effect.fail(new ApiSdkServiceError({ cause: error.message })),
          }),
        ),
      )
      .handle("resolvePaywall", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const projectId = session?.projects[0]?.id;
            if (!projectId) {
              return yield* Effect.fail(
                new ApiSdkServiceError({ cause: "No project associated with this key" }),
              );
            }

            // Resolve the subject the same way `evaluateFeatureFlags` does so an
            // experiment-backed location buckets on a stable identity.
            const distinctId = session?.person?.distinctId ?? undefined;
            let personId: string | undefined;
            if (distinctId) {
              const mapping = yield* dbService.query.personIdentities.findFirst({
                where: { distinctId, projectId },
              });
              personId = mapping?.personId;
            }

            const resolved = yield* paywallLocationService.resolveLocationShowingForSdk({
              locationSlug: payload.locationSlug,
              projectId,
              personId,
              distinctId,
            });
            if (resolved === null) {
              return null;
            }

            // `resolved.exposure` (when non-null) carries { experimentId,
            // variantKey, personId, distinctId } for the assigned subject.
            // Server-side `$experiment.exposed` emission is wired here once the
            // analytics dispatch producer (`AnalyticsDispatchService` over the
            // worker's `CaptureIngressLive`) + `RuntimeContext` are threaded into
            // the SDK route runtime — see `EXPERIMENT_TRUSTED_SOURCE_TOPIC` /
            // `makeCapturedEventFromInternalAnalyticsEvent`. Assignment + serving
            // (below) are fully live; emission is the remaining infra step.

            return new SdkResolvedPaywall({
              location: resolved.location,
              showing: new SdkResolvedPaywallShowing(resolved.showing),
            });
          }),
        ).pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiSdkServiceError({ cause: String(e.message) })),
            PaywallLocationServiceError: (e) =>
              Effect.fail(new ApiSdkServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getSchema", () =>
        Effect.gen(function* () {
          const req = yield* HttpServerRequest.HttpServerRequest;
          const ifNoneMatch = HttpHeaders.get(req.headers, "if-none-match");

          return yield* bridgeAuthSession(
            Effect.gen(function* () {
              const session = yield* AuthSession;
              const projectId = session?.projects[0]?.id;
              if (!projectId) {
                return yield* Effect.fail(
                  new ApiAuthenticationError({
                    cause: "No project associated with this publishable key",
                    message: "No project associated with this publishable key",
                  }),
                );
              }

              const schema = yield* schemaService.getProjectSchemaForSdk(projectId);
              const dbProducts = yield* dbService.query.products.findMany({
                where: { projectId },
              });
              const dbProductBySlug = new Map(dbProducts.map((product) => [product.slug, product]));

              const notModified = schemaNotModifiedResponse(
                Option.getOrUndefined(ifNoneMatch),
                schema.version,
              );
              if (notModified) {
                return notModified;
              }

              const perks: Record<string, SdkSchemaPerk> = {};
              for (const perk of schema.perks) {
                perks[perk.slug] = new SdkSchemaPerk(perk);
              }

              const locations: Record<string, SdkSchemaLocation> = {};
              for (const location of schema.locations) {
                locations[location.slug] = new SdkSchemaLocation(location);
              }

              const products: Record<string, SdkSchemaProduct> = {};
              for (const product of schema.products) {
                const perksRecord: Record<string, true> = {};
                for (const perkSlug of product.perks) {
                  perksRecord[perkSlug] = true;
                }
                const providers: {
                  appleAppStore?: Record<string, unknown>;
                  googlePlay?: Record<string, unknown>;
                } = {};
                for (const provider of product.providers) {
                  providers[provider.providerId] = provider.configuration;
                }
                const dbProduct = dbProductBySlug.get(product.slug);
                if (!dbProduct) {
                  continue;
                }
                const developmentPrice = getDevelopmentPrice(
                  asProductType(dbProduct.type),
                  asSubscriptionDuration(dbProduct.duration),
                );
                products[product.slug] = new SdkSchemaProduct({
                  configuration: {
                    perks: perksRecord,
                    providers: {
                      ...providers,
                      development: {
                        currencyCode: developmentPrice.currencyCode,
                        duration: developmentPrice.duration,
                        period: developmentPrice.period,
                        periodCount: developmentPrice.periodCount,
                        price: developmentPrice.amount / 100,
                        priceInMinorUnits: developmentPrice.amount,
                        productId: product.slug,
                        warning: developmentPrice.warning,
                      },
                    },
                  },
                  duration: product.duration,
                  id: dbProduct.id,
                  properties: { name: product.name },
                  slug: product.slug,
                  type: product.type,
                });
              }

              return yield* HttpServerResponse.schemaJson(SdkSchema)(
                new SdkSchema({ locations, perks, products, version: schema.version }),
                { headers: schemaResponseHeaders(schema.version) },
              ).pipe(Effect.orDie);
            }),
          );
        }).pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiSchemaServiceError({ cause: String(e.cause) })),
            SchemaServiceError: (e) => Effect.fail(new ApiSchemaServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("evaluateFeatureFlags", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const projectId = session?.projects[0]?.id;
            if (!projectId) {
              return yield* Effect.fail(
                new ApiSdkServiceError({ cause: "No project associated with this key" }),
              );
            }

            const distinctId = session?.person?.distinctId ?? undefined;

            let personId: string | undefined;
            if (distinctId) {
              const mapping = yield* dbService.query.personIdentities.findFirst({
                where: { distinctId, projectId },
              });
              personId = mapping?.personId;
            }

            const results = yield* featureFlagService.evaluateFlagsBatch({
              personId,
              distinctId,
              keys: optionalListCopy(payload.flagKeys),
              projectId,
            });

            return new SdkFeatureFlagsResponse({
              flags: results.map(
                (r) =>
                  new SdkFeatureFlagResult({
                    enabled: r.enabled,
                    key: r.key,
                    payload: r.payload,
                    variantKey: r.variantKey,
                  }),
              ),
            });
          }),
        ).pipe(
          Effect.catchTags({
            FeatureFlagServiceError: (e) => Effect.fail(new ApiSdkServiceError({ cause: e.cause })),
            EffectDrizzleQueryError: (e) =>
              Effect.fail(new ApiSdkServiceError({ cause: String(e.message) })),
          }),
        ),
      )
      .handle("registerDevice", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const project = session?.projects[0];
            if (!project) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No project associated with this SDK authentication session",
                  message: "No project associated with this SDK authentication session",
                }),
              );
            }
            yield* requireNotificationsEnabled(project.organizationId);
            const projectId = project.id;
            const distinctId = session?.person?.distinctId;
            if (!distinctId) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No SDK person identity found in this authentication session",
                  message: "No SDK person identity found in this authentication session",
                }),
              );
            }

            // Resolve the CANONICAL caller person from the (spoofable) distinct
            // id, creating an anonymous person if needed — ownership is bound
            // here server-side, never trusted from the raw header downstream.
            const eventTimestamp = yield* DateTime.nowAsDate;
            const resolution = yield* personIdentityService.resolveDistinctId({
              projectId,
              distinctId,
              shouldCreatePerson: true,
              eventTimestamp,
              setAttributes: {},
              setOnceAttributes: {},
            });
            const callerPersonId = resolution.identity.personId;
            if (!callerPersonId) {
              return yield* Effect.fail(
                new ApiPushDeviceServiceError({ cause: "could not resolve caller person" }),
              );
            }

            const { pushDeviceTokenId } = yield* notificationTokenService.register({
              projectId,
              callerPersonId,
              platform: payload.platform,
              provider: payload.provider,
              platformToken: payload.platformToken,
              bundleId: payload.bundleId,
              environment: payload.environment,
              previousPushDeviceTokenId: payload.previousPushDeviceTokenId,
            });
            return new RegisterDeviceResponse({ pushDeviceTokenId });
          }),
        ).pipe(
          Effect.catchTags({
            PersonServiceError: (e) =>
              Effect.fail(new ApiPushDeviceServiceError({ cause: String(e.cause) })),
            NotificationTokenServiceError: (e) =>
              Effect.fail(new ApiPushDeviceServiceError({ cause: e.cause })),
            InvalidPushMessageError: (e) =>
              Effect.fail(new ApiPushDeviceValidationError({ message: e.message })),
          }),
        ),
      )
      .handle("refreshDevice", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const project = session?.projects[0];
            if (!project) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No project associated with this SDK authentication session",
                  message: "No project associated with this SDK authentication session",
                }),
              );
            }
            yield* requireNotificationsEnabled(project.organizationId);
            const projectId = project.id;
            const distinctId = session?.person?.distinctId;
            if (!distinctId) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No SDK person identity found in this authentication session",
                  message: "No SDK person identity found in this authentication session",
                }),
              );
            }

            // Do NOT create a person here: a non-existent person cannot own the
            // device, so an unresolved caller maps to the UNIFORM NotFound.
            const eventTimestamp = yield* DateTime.nowAsDate;
            const resolution = yield* personIdentityService.resolveDistinctId({
              projectId,
              distinctId,
              shouldCreatePerson: false,
              eventTimestamp,
              setAttributes: {},
              setOnceAttributes: {},
            });
            const callerPersonId = resolution.identity.personId;
            if (!callerPersonId) {
              return yield* Effect.fail(
                new ApiPushDeviceNotFoundError({ message: "device token not found" }),
              );
            }

            yield* notificationTokenService.refresh({
              projectId,
              callerPersonId,
              pushDeviceTokenId: payload.pushDeviceTokenId,
              newPlatformToken: payload.platformToken,
            });
          }),
        ).pipe(
          Effect.catchTags({
            PersonServiceError: (e) =>
              Effect.fail(new ApiPushDeviceServiceError({ cause: String(e.cause) })),
            NotificationTokenServiceError: (e) =>
              Effect.fail(new ApiPushDeviceServiceError({ cause: e.cause })),
            PushDeviceTokenNotFoundError: () =>
              Effect.fail(new ApiPushDeviceNotFoundError({ message: "device token not found" })),
          }),
        ),
      )
      .handle("unregisterDevice", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const project = session?.projects[0];
            if (!project) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No project associated with this SDK authentication session",
                  message: "No project associated with this SDK authentication session",
                }),
              );
            }
            yield* requireNotificationsEnabled(project.organizationId);
            const projectId = project.id;
            const distinctId = session?.person?.distinctId;
            if (!distinctId) {
              return yield* Effect.fail(
                new ApiAuthenticationError({
                  cause: "No SDK person identity found in this authentication session",
                  message: "No SDK person identity found in this authentication session",
                }),
              );
            }

            const eventTimestamp = yield* DateTime.nowAsDate;

            const resolution = yield* personIdentityService.resolveDistinctId({
              projectId,
              distinctId,
              shouldCreatePerson: false,
              eventTimestamp,
              setAttributes: {},
              setOnceAttributes: {},
            });
            const callerPersonId = resolution.identity.personId;
            if (!callerPersonId) {
              return yield* Effect.fail(
                new ApiPushDeviceNotFoundError({ message: "device token not found" }),
              );
            }

            yield* notificationTokenService.unregister({
              projectId,
              callerPersonId,
              pushDeviceTokenId: payload.pushDeviceTokenId,
            });
          }),
        ).pipe(
          Effect.catchTags({
            PersonServiceError: (e) =>
              Effect.fail(new ApiPushDeviceServiceError({ cause: String(e.cause) })),
            NotificationTokenServiceError: (e) =>
              Effect.fail(new ApiPushDeviceServiceError({ cause: e.cause })),
            PushDeviceTokenNotFoundError: () =>
              Effect.fail(new ApiPushDeviceNotFoundError({ message: "device token not found" })),
          }),
        ),
      );
  }),
);
