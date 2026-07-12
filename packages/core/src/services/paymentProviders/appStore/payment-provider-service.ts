/**
 * Live implementation of the public {@link AppStorePaymentProviderService}
 * boundary for the Cloudflare backend.
 *
 * Owns the SDK-path orchestration (project → configuration → Apple REST fetch →
 * decode → forward to {@link AppStorePaymentProvider.recordPurchase}) and
 * delegates webhook ingress to {@link AppStoreWebhookHandlerService}.
 *
 * Ported from `internal/packages/core/.../app-store-payment-provider-service.ts`
 * with two backend-specific changes:
 *   1. The SDK path resolves the project from an explicit `projectId` input
 *      instead of yielding `AuthSession` from context — this keeps the method's
 *      `R` channel `never` as the service shape requires. `SdkService` passes
 *      the project-elevated id.
 *   2. The deferred-replay and lazy first-seen reconciliation workflow triggers
 *      ARE fired here, through abstract ports
 *      ({@link AppStoreReplayParkedSdkNotificationsWorkflow},
 *      {@link AppStoreReconcileOriginalTransactionWorkflow}) that the
 *      application root wires to concrete Cloudflare Workflows. Both are
 *      fire-and-forget (awaited `create` + log-on-failure, never `forkDetach`),
 *      and the synchronous record path does not depend on their completion.
 */
import { Environment } from "@voidhash/app-store-server-sdk";
import { ProviderEnvironment } from "@voidhash/db";
import { Effect, Layer, Option, Schema } from "effect";

import {
  AppStorePaymentProviderService,
  AppStorePaymentProviderServiceError,
  type AppStorePaymentProviderServiceShape,
} from "../AppStorePaymentProviderService.ts";
import { AppStoreReconcileOriginalTransactionWorkflow } from "../AppStoreReconcileOriginalTransactionWorkflow.ts";
import { AppStoreReplayParkedSdkNotificationsWorkflow } from "../AppStoreReplayParkedSdkNotificationsWorkflow.ts";
import { AppStoreWebhookHandlerService } from "./app-store-webhook-handler-service.ts";
import { getActiveAppStorePaymentProviderConfiguration } from "./helpers.ts";
import { AppStorePaymentProvider, globalConfigurationSchema } from "./payment-provider.ts";
import { AppStorePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";

/**
 * Best-effort extraction of a human-readable cause from any upstream failure
 * (SDK errors carry `errorMessage: Option<string>`, infra errors carry
 * `message`/`cause`). Used to collapse the rich error union the SDK path can
 * produce into the single {@link AppStorePaymentProviderServiceError} the
 * public boundary exposes.
 */
const extractCause = (error: unknown): string => {
  if (error instanceof AppStorePaymentProviderServiceError) return error.cause;
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      errorMessage?: unknown;
      message?: unknown;
      cause?: unknown;
      status?: unknown;
    };
    if (Option.isOption(candidate.errorMessage) && Option.isSome(candidate.errorMessage)) {
      return String(candidate.errorMessage.value);
    }
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.cause === "string") return candidate.cause;
    if (typeof candidate.status === "string") return String(candidate.status);
  }
  return String(error);
};

const toServiceError = (error: unknown): AppStorePaymentProviderServiceError =>
  error instanceof AppStorePaymentProviderServiceError
    ? error
    : new AppStorePaymentProviderServiceError({ cause: extractCause(error) });

/**
 * Live layer for {@link AppStorePaymentProviderService}. Composes the ported
 * provider engine, webhook handler, and queries; its residual requirements
 * (`Db`, `FxRateService`, `PersonIdentityService`, `PurchaseProcessingService`,
 * `AppStoreServerSdk`, `HttpClient`) are satisfied by the backend root.
 */
export const AppStorePaymentProviderServiceLive = Layer.effect(AppStorePaymentProviderService)(
  Effect.gen(function* () {
    const appStorePaymentProvider = yield* AppStorePaymentProvider;
    const appStoreWebhookHandlerService = yield* AppStoreWebhookHandlerService;
    const queries = yield* AppStorePaymentProviderServiceQueries;

    const processSdkTransaction = Effect.fn("processSdkTransaction")(
      function* (input: {
        readonly bundleId: string;
        readonly distinctId: string;
        readonly projectId: string;
        readonly receivedAt: Date;
        readonly transactionId: string;
      }) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.payment_provider.bundle_id", input.bundleId);
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
        yield* Effect.annotateCurrentSpan("voidhash.transaction.id", input.transactionId);
        const configurations = yield* queries.findPaymentProviderConfigurationsByProjectId(
          input.projectId,
        );
        const paymentProviderKey = yield* appStorePaymentProvider.createGlobalKey(input);
        const configuration = yield* getActiveAppStorePaymentProviderConfiguration(
          configurations,
          input.bundleId,
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

        const sdkContext =
          yield* appStorePaymentProvider.buildSdkContextFromConfiguration(configuration);
        const transactionInfoResult = yield* sdkContext.getTransactionInfo(input.transactionId);
        const signedTransactionInfo = Option.getOrUndefined(
          transactionInfoResult.transactionInfo.signedTransactionInfo,
        );
        if (!signedTransactionInfo) {
          return yield* new AppStorePaymentProviderServiceError({
            cause: "Signed transaction info is not found",
          });
        }

        const decodedTransaction = yield* sdkContext.decodeSignedTransaction(
          signedTransactionInfo,
          transactionInfoResult.environment,
        );
        const providerEnvironment =
          transactionInfoResult.environment === Environment.SANDBOX
            ? ProviderEnvironment.Sandbox
            : ProviderEnvironment.Production;

        // Decide first-seen reconciliation BEFORE `recordPurchase` writes the
        // subscription/transaction row — afterwards the existence check below is
        // always true. Gated per-tenant (`enableFirstSeenReconciliation`, off by
        // default) and only when this `originalTransactionId` series is genuinely
        // unseen, so the cost-bearing Apple-history backfill fires at most once
        // per series. A bad config blob decodes to `none` (treated as disabled);
        // reconciliation is idempotent, so a missed guard is only a wasted run.
        const originalTransactionId = Option.getOrUndefined(
          decodedTransaction.originalTransactionId,
        );
        const shouldReconcileFirstSeen = originalTransactionId
          ? yield* Effect.gen(function* () {
              const parsedGlobalConfiguration = yield* Schema.decodeUnknownEffect(
                globalConfigurationSchema,
              )(configuration.configuration).pipe(Effect.option);
              const enabled = Option.match(parsedGlobalConfiguration, {
                onNone: () => false,
                onSome: (parsed) => parsed.enableFirstSeenReconciliation === true,
              });
              if (!enabled) {
                return false;
              }
              const alreadyRecorded = yield* queries.hasAnyAppStoreRecordForOriginalTransactionId({
                originalTransactionId,
              });
              return !alreadyRecorded;
            })
          : false;

        const result = yield* appStorePaymentProvider.recordPurchase({
          configuration,
          decodedRenewalInfo: Option.none(),
          decodedTransaction,
          distinctId: input.distinctId,
          project: fullProject,
          providerEnvironment,
          receivedAt: input.receivedAt,
          sdkTransactionId: input.transactionId,
          source: "sdk",
        });

        // Deferred-replay trigger: under the per-tenant
        // `trackNewPurchasesFromAppleServerNotifications = false` mode,
        // lifecycle webhooks for this series were parked pending this SDK
        // confirmation. Now that the purchase is recorded, dispatch the replay
        // workflow to drain them — but only if any are actually parked, so the
        // common (flag-on) path costs nothing. The record above is
        // authoritative on its own; this only re-applies held-back events.
        if (originalTransactionId) {
          const parked = yield* queries.findParkedNotificationsByOriginalTransactionId({
            originalTransactionId,
            paymentProviderConfigurationId: configuration.id,
          });
          if (parked.length > 0) {
            yield* AppStoreReplayParkedSdkNotificationsWorkflow.pipe(
              Effect.flatMap((workflow) =>
                workflow.dispatch({
                  originalTransactionId,
                  paymentProviderConfigurationId: configuration.id,
                }),
              ),
              Effect.catchCause((cause) =>
                Effect.logWarning("Failed to schedule App Store parked SDK-notification replay", {
                  cause,
                  originalTransactionId,
                }),
              ),
            );
          }
        }

        // Lazy first-seen reconciliation. Decided pre-`recordPurchase` above, so
        // it fires at most once per `originalTransactionId` per flag-on tenant;
        // Cloudflare handles Apple 429 backoff at the workflow level, and each
        // replayed event is idempotent. Admin-repair / install-backfill remain
        // separate manual triggers. Awaited `create` + log-on-failure (mirrors
        // the parked-replay dispatch above); never `forkDetach`.
        if (shouldReconcileFirstSeen && originalTransactionId) {
          yield* AppStoreReconcileOriginalTransactionWorkflow.pipe(
            Effect.flatMap((workflow) =>
              workflow.dispatch({
                originalTransactionId,
                paymentProviderConfigurationId: configuration.id,
                reason: "first_seen",
                triggeredAt: input.receivedAt.toISOString(),
              }),
            ),
            Effect.catchCause((cause) =>
              Effect.logWarning("Failed to schedule App Store first-seen reconciliation", {
                cause,
                originalTransactionId,
              }),
            ),
          );
        }

        yield* Effect.annotateCurrentSpan("voidhash.person.id", result.personId);
        return { personId: result.personId };
      },
      (effect) => effect.pipe(Effect.catch((error) => Effect.fail(toServiceError(error)))),
    );

    // Boundary cast: the underlying purchase/identity engine reaches Cloudflare
    // bindings through the deployed-worker resource handle, so the `record*`
    // path carries a residual `Cloudflare.Worker` requirement in its `R`
    // channel (the only residual once the provider/handler/queries are
    // provided). That resource is ambient whenever this service runs — it
    // executes inside the deployed Worker — so the requirement is always
    // satisfied at call time, and the public shape models it as `never`. We
    // assert that here rather than thread the alchemy IaC resource type through
    // the core service contract.
    // TODO(app-store): replace this cast by providing the worker-resource layer
    // to AppStorePaymentProviderServiceLive at the backend root once the
    // request-graph wiring for `Cloudflare.Worker` is finalized.
    return {
      acceptServerNotification: appStoreWebhookHandlerService.acceptServerNotification,
      processSdkTransaction,
    } as unknown as AppStorePaymentProviderServiceShape;
  }),
  // `Layer.provide` (not `provideMerge`): the webhook handler / provider engine /
  // queries are implementation details consumed here, not part of this service's
  // public output. Exposing only `AppStorePaymentProviderService` also keeps the
  // layer's inferred type nameable from the application root.
).pipe(Layer.provide(AppStoreWebhookHandlerService.layer));
