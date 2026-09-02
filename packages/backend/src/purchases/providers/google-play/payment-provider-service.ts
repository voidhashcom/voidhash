/**
 * Live implementation of the public {@link GooglePlayPaymentProviderService}
 * boundary for the Cloudflare backend. Mirrors the App Store live service.
 *
 * Owns the SDK-path orchestration (project → configuration → Play API fetch →
 * normalize → forward to {@link GooglePlayPaymentProvider.recordPurchase}) and
 * delegates webhook ingress to {@link GooglePlayWebhookHandlerService}.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";

import {
  GooglePlayPaymentProviderService,
  type GooglePlayPaymentProviderServiceShape,
  type GooglePlaySdkTransactionResult,
} from "@voidhash/core-v2";
import {
  GooglePlayPaymentProviderProductNotMappedError,
  GooglePlayPaymentProviderServiceError,
} from "./errors.ts";
import { generateId } from "@voidhash/core/utils/generate-id";
import { getActiveGooglePlayPaymentProviderConfiguration } from "./helpers.ts";
import { GooglePlayPaymentProvider } from "./payment-provider.ts";
import { GooglePlayPaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import { GooglePlayPurchaseVerifier } from "./purchase-verifier.ts";
import { GooglePlayWebhookHandlerService } from "./webhook-handler-service.ts";
import { MutableSet } from "../../../collection-boundary.ts";
import { hasTag } from "../../../runtime-boundary.ts";
import { assumeType } from "../../../runtime-boundary.ts";

/** Reads a property off an unknown value without an `as` assertion. */
const readProperty = <P extends string>(value: unknown, property: P): unknown => {
  if (P.hasProperty(value, property)) return value[property];
  return undefined;
};

/**
 * Best-effort extraction of a human-readable cause from any upstream failure
 * (Play SDK errors carry `message`, infra errors carry `cause`). Collapses the
 * rich error union into the single {@link GooglePlayPaymentProviderServiceError}
 * the public boundary exposes.
 */
const extractCause = (error: unknown): string => {
  if (error instanceof GooglePlayPaymentProviderServiceError) return error.cause;
  if (P.isObject(error) && error !== null) {
    const message = readProperty(error, "message");
    if (P.isString(message)) return message;
    const cause = readProperty(error, "cause");
    if (P.isString(cause)) return cause;
    const status = readProperty(error, "status");
    if (P.isString(status)) return String(status);
  }
  return String(error);
};

/** Error tags that mark a permanently missing target — mapped to `kind: "not_found"`. */
const NOT_FOUND_ERROR_TAGS = new MutableSet<string>([
  "GooglePlayPaymentProviderConfigurationNotFoundError",
  "GooglePlayPaymentProviderProjectNotFoundError",
]);

const toServiceError = (error: unknown): GooglePlayPaymentProviderServiceError => {
  if (error instanceof GooglePlayPaymentProviderServiceError) return error;
  const tag = readProperty(error, "_tag");
  if (P.isString(tag) && NOT_FOUND_ERROR_TAGS.has(tag)) {
    return new GooglePlayPaymentProviderServiceError({
      cause: extractCause(error),
      kind: "not_found",
    });
  }
  return new GooglePlayPaymentProviderServiceError({ cause: extractCause(error) });
};

export const GooglePlayPaymentProviderServiceLive = Layer.effect(GooglePlayPaymentProviderService)(
  Effect.gen(function* () {
    const googlePlayPaymentProvider = yield* GooglePlayPaymentProvider;
    const purchaseVerifier = yield* GooglePlayPurchaseVerifier;
    const googlePlayWebhookHandlerService = yield* GooglePlayWebhookHandlerService;
    const queries = yield* GooglePlayPaymentProviderServiceQueries;

    const processSdkTransaction = Effect.fn("processSdkTransaction")(
      function* (input: {
        readonly packageName: string;
        readonly productId: string;
        readonly purchaseToken: string;
        readonly distinctId: string;
        readonly projectId: string;
        readonly receivedAt: Date;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.package_name",
          input.packageName,
        );
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);

        const configurations = yield* queries.findPaymentProviderConfigurationsByProjectId(
          input.projectId,
        );
        const paymentProviderKey = yield* googlePlayPaymentProvider.createGlobalKey({
          packageName: input.packageName,
        });
        const configuration = yield* getActiveGooglePlayPaymentProviderConfiguration(
          configurations,
          input.packageName,
          paymentProviderKey,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.configuration_id",
          configuration.id,
        );

        const fullProject = yield* queries.findProjectById(input.projectId);
        if (!fullProject) {
          return yield* Effect.die(`Project ${input.projectId} not found`);
        }

        const fetched = yield* purchaseVerifier.verify({
          configuration,
          productId: input.productId,
          purchaseToken: input.purchaseToken,
        });

        const result = yield* googlePlayPaymentProvider
          .recordPurchase({
            configuration,
            distinctId: input.distinctId,
            eventTime: input.receivedAt,
            project: fullProject,
            providerEnvironment: fetched.providerEnvironment,
            purchase: fetched.purchase,
            receivedAt: input.receivedAt,
            source: "sdk",
          })
          .pipe(
            Effect.catchIf(
              (error): error is GooglePlayPaymentProviderProductNotMappedError =>
                P.hasProperty(error, "_tag") &&
                hasTag(error, "GooglePlayPaymentProviderProductNotMappedError"),
              (error) =>
                Effect.fn("result")(function* () {
                  yield* queries.insertNotificationProcessedIfAbsent({
                    id: generateId("paymentProviderNotification"),
                    notificationSubtype: null,
                    notificationType: "SDK_PURCHASE",
                    notificationUuid: `sdk:${input.purchaseToken}:${input.productId}`.slice(0, 255),
                    parkedRawPayload: {
                      distinctId: input.distinctId,
                      productId: input.productId,
                      purchaseToken: input.purchaseToken,
                      receivedAt: input.receivedAt.toISOString(),
                    },
                    parkedUntilProviderProductKey: error.providerProductKey,
                    paymentProviderConfigurationId: configuration.id,
                    providerId: "google-play",
                    providerOccurredAt: input.receivedAt,
                    result: "parked_pending_product_mapping",
                    resultNote: `SDK purchase waiting for product key ${error.providerProductKey}`,
                    source: "sdk",
                  });
                  // The row is parked for replay — an eventually-consistent
                  // success from the client's perspective, not an error.
                  return {
                    parked: true,
                    providerProductKey: error.providerProductKey,
                  } satisfies GooglePlaySdkTransactionResult;
                })(),
            ),
          );
        if ("parked" in result) {
          yield* Effect.annotateCurrentSpan("voidhash.purchase.parked", "true");
          return {
            parked: true,
            providerProductKey: result.providerProductKey,
          } satisfies GooglePlaySdkTransactionResult;
        }
        const recordedPersonId = result.personId;

        yield* Effect.annotateCurrentSpan("voidhash.person.id", recordedPersonId);
        return {
          parked: false,
          personId: recordedPersonId,
        } satisfies GooglePlaySdkTransactionResult;
      },
      (effect) => effect.pipe(Effect.catch((error) => Effect.fail(toServiceError(error)))),
    );

    // Boundary cast (mirrors App Store): the engine/handler resolve all their
    // deps at layer-build time, but the inferred `R`/`E` may still carry a
    // residual the public shape models as `never`. The deps are ambient at call
    // time (the service runs inside the deployed Worker).
    // oxlint-disable-next-line effect/noAs -- boundary cast described in the comment above: the residual R/E left by the engine is ambient at call time inside the deployed Worker, and satisfies is not an assertion so it cannot erase it.
    return assumeType<GooglePlayPaymentProviderServiceShape>({
      acceptRtdnNotification: (input: {
        readonly paymentProviderConfigurationId: string;
        readonly receivedAt: Date;
        readonly pubsubBody: unknown;
      }) =>
        googlePlayWebhookHandlerService
          .acceptRtdnNotification(input)
          .pipe(Effect.catch((error) => Effect.fail(toServiceError(error)))),
      processSdkTransaction,
    });
  }),
).pipe(Layer.provide(GooglePlayWebhookHandlerService.layer));
