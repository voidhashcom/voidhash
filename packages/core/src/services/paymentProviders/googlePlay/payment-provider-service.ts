/**
 * Live implementation of the public {@link GooglePlayPaymentProviderService}
 * boundary for the Cloudflare backend. Mirrors the App Store live service.
 *
 * Owns the SDK-path orchestration (project → configuration → Play API fetch →
 * normalize → forward to {@link GooglePlayPaymentProvider.recordPurchase}) and
 * delegates webhook ingress to {@link GooglePlayWebhookHandlerService}.
 */
import { Effect, Layer } from "effect";

import {
  GooglePlayPaymentProviderService,
  type GooglePlayPaymentProviderServiceShape,
} from "../GooglePlayPaymentProviderService.ts";
import { GooglePlayPaymentProviderServiceError } from "./errors.ts";
import { getActiveGooglePlayPaymentProviderConfiguration } from "./helpers.ts";
import { GooglePlayPaymentProvider } from "./payment-provider.ts";
import { GooglePlayPaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import { GooglePlayPurchaseVerifier } from "./purchase-verifier.ts";
import { GooglePlayWebhookHandlerService } from "./webhook-handler-service.ts";

/**
 * Best-effort extraction of a human-readable cause from any upstream failure
 * (Play SDK errors carry `message`, infra errors carry `cause`). Collapses the
 * rich error union into the single {@link GooglePlayPaymentProviderServiceError}
 * the public boundary exposes.
 */
const extractCause = (error: unknown): string => {
  if (error instanceof GooglePlayPaymentProviderServiceError) return error.cause;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; cause?: unknown; status?: unknown };
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.cause === "string") return candidate.cause;
    if (typeof candidate.status === "string") return String(candidate.status);
  }
  return String(error);
};

const toServiceError = (error: unknown): GooglePlayPaymentProviderServiceError =>
  error instanceof GooglePlayPaymentProviderServiceError
    ? error
    : new GooglePlayPaymentProviderServiceError({ cause: extractCause(error) });

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

        const result = yield* googlePlayPaymentProvider.recordPurchase({
          configuration,
          distinctId: input.distinctId,
          eventTime: input.receivedAt,
          project: fullProject,
          providerEnvironment: fetched.providerEnvironment,
          purchase: fetched.purchase,
          receivedAt: input.receivedAt,
          source: "sdk",
        });

        yield* Effect.annotateCurrentSpan("voidhash.person.id", result.personId);
        return { personId: result.personId };
      },
      (effect) => effect.pipe(Effect.catch((error) => Effect.fail(toServiceError(error)))),
    );

    // Boundary cast (mirrors App Store): the engine/handler resolve all their
    // deps at layer-build time, but the inferred `R`/`E` may still carry a
    // residual the public shape models as `never`. The deps are ambient at call
    // time (the service runs inside the deployed Worker).
    return {
      acceptRtdnNotification: (input: {
        readonly paymentProviderConfigurationId: string;
        readonly receivedAt: Date;
        readonly pubsubBody: unknown;
      }) =>
        googlePlayWebhookHandlerService
          .acceptRtdnNotification(input)
          .pipe(Effect.catch((error) => Effect.fail(toServiceError(error)))),
      processSdkTransaction,
    } as unknown as GooglePlayPaymentProviderServiceShape;
  }),
).pipe(Layer.provide(GooglePlayWebhookHandlerService.layer));
