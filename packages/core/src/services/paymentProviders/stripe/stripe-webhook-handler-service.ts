/**
 * Stripe webhook ingress. Verifies the `Stripe-Signature` HMAC against the
 * per-tenant signing secret, decodes the event, and dispatches it to the
 * matching `record*` method on the {@link StripePaymentProvider} engine. Mirrors
 * `appStore/app-store-webhook-handler-service.ts`, minus the Apple
 * SDK-confirmation parking (Stripe webhooks are authoritative) — only the
 * product-not-mapped park flavor applies. The wire-dedup ledger
 * (`payment_provider_notification_processed`, UNIQUE on `(configId, event.id)`)
 * is shared verbatim with the App Store path.
 */
import { generateId } from "../../../utils/index.ts";
import { Effect, Layer, Match, Predicate, Context } from "effect";

import {
  StripePaymentProviderConfigurationNotFoundError,
  StripePaymentProviderProductNotMappedError,
  StripePaymentProviderProjectNotFoundError,
  StripePaymentProviderServiceError,
  StripeWebhookSignatureError,
} from "./errors.ts";
import type { StripeAcceptWebhookEventResult } from "../StripePaymentProviderService.ts";
import { decodeStripeEvent, StripeEventType } from "./events.ts";
import { StripePaymentProvider, type StripeRecordInput } from "./payment-provider.ts";
import { StripePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import type { StripeContext, StripeMode } from "./sdk-context.ts";
import { ProviderEnvironment } from "@voidhash/db";

const truncateResultNote = (note: string): string => note.slice(0, 500);

/** Tags `handled` collapses into a terminal "failed" ledger row (permanent, don't retry). */
const TERMINAL_RECORD_FAILURE_TAGS = new Set<string>([
  "StripePurchaseProcessingIdempotencyKeyDerivationError",
  "InvalidISO4217CurrencyCodeError",
]);

const isTerminalRecordFailure = (error: unknown): boolean =>
  Predicate.hasProperty(error, "_tag") &&
  typeof error._tag === "string" &&
  TERMINAL_RECORD_FAILURE_TAGS.has(error._tag);

/**
 * Collapses any internal failure into the public {@link StripePaymentProviderServiceError},
 * stamping the routing `kind` (signature / not_found / transient) the ingress
 * route maps to an HTTP status. Errors raised before/around the dispatch
 * (signature, config/project not found) keep their semantics; everything else
 * is a transient infra failure Stripe should retry.
 */
const toStripeServiceError = (error: unknown): StripePaymentProviderServiceError => {
  if (error instanceof StripePaymentProviderServiceError) return error;
  if (error instanceof StripeWebhookSignatureError) {
    return new StripePaymentProviderServiceError({ cause: error.reason, kind: "signature" });
  }
  if (error instanceof StripePaymentProviderConfigurationNotFoundError) {
    return new StripePaymentProviderServiceError({
      cause: `payment provider configuration ${error.paymentProviderConfigurationId} not found`,
      kind: "not_found",
    });
  }
  if (error instanceof StripePaymentProviderProjectNotFoundError) {
    return new StripePaymentProviderServiceError({
      cause: `project ${error.projectId} not found`,
      kind: "not_found",
    });
  }
  const cause =
    Predicate.hasProperty(error, "cause") && typeof error.cause === "string"
      ? error.cause
      : String(error);
  return new StripePaymentProviderServiceError({ cause, kind: "transient" });
};

const describeRecordFailure = (error: unknown): string => {
  if (
    Predicate.hasProperty(error, "_tag") &&
    error._tag === "StripePurchaseProcessingIdempotencyKeyDerivationError"
  ) {
    const eventType = Predicate.hasProperty(error, "eventType")
      ? String(error.eventType)
      : "unknown";
    const missingField = Predicate.hasProperty(error, "missingField")
      ? String(error.missingField)
      : "unknown";
    return `idempotency key derivation failed for ${eventType}: missing ${missingField}`;
  }
  return `invalid ISO 4217 currency code: ${String(error)}`;
};

export class StripeWebhookHandlerService extends Context.Service<StripeWebhookHandlerService>()(
  "StripeWebhookHandlerService",
  {
    make: Effect.gen(function* () {
      const queries = yield* StripePaymentProviderServiceQueries;
      const stripePaymentProvider = yield* StripePaymentProvider;

      const acceptWebhookEvent = Effect.fn("acceptWebhookEvent")(
        function* (input: {
          readonly paymentProviderConfigurationId: string;
          readonly rawBody: string;
          readonly signatureHeader: string;
          readonly receivedAt: Date;
          /** Set by the parked-replay path: skip signature verification (the stored body was already verified) and the freshness window. */
          readonly isReplay?: boolean;
        }) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.configuration_id",
            input.paymentProviderConfigurationId,
          );
          const configuration = yield* queries.findPaymentProviderConfigurationById(
            input.paymentProviderConfigurationId,
          );
          if (!configuration) {
            return yield* new StripePaymentProviderConfigurationNotFoundError({
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            });
          }
          yield* Effect.annotateCurrentSpan(
            "voidhash.payment_provider.id",
            configuration.providerId,
          );

          const project = yield* queries.findProjectById(configuration.projectId);
          if (!project) {
            return yield* new StripePaymentProviderProjectNotFoundError({
              projectId: configuration.projectId,
            });
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", project.id);

          const stripeContext: StripeContext =
            yield* stripePaymentProvider.buildContextFromConfiguration(configuration);

          // Live ingress verifies the HMAC; replay trusts the already-verified
          // stored body (the signature header is not persisted) and derives the
          // mode from `livemode`.
          const { event, mode } = input.isReplay
            ? yield* Effect.gen(function* () {
                const parsed = yield* Effect.try({
                  catch: (error) =>
                    new StripePaymentProviderServiceError({
                      cause: `parked Stripe payload is not valid JSON: ${String(error)}`,
                    }),
                  try: () => JSON.parse(input.rawBody) as unknown,
                });
                const decoded = yield* decodeStripeEvent(parsed);
                return {
                  event: decoded,
                  mode: (decoded.livemode === false ? "test" : "live") as StripeMode,
                };
              })
            : yield* stripeContext.verifyAndDecodeEvent({
                rawBody: input.rawBody,
                signatureHeader: input.signatureHeader,
                skipTimestampTolerance: false,
              });

          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.event_type", event.type);
          yield* Effect.annotateCurrentSpan("voidhash.webhook.id", event.id);

          const providerEnvironment =
            mode === "test" ? ProviderEnvironment.Sandbox : ProviderEnvironment.Production;

          const ack = (handled: boolean): StripeAcceptWebhookEventResult => ({
            accepted: true,
            eventId: event.id,
            eventType: event.type,
            handled,
          });

          let terminalLedgerResult: "failed" | undefined;
          let terminalLedgerResultNote: string | null = null;

          const markTerminalRecordFailure = (reason: string) =>
            Effect.gen(function* () {
              terminalLedgerResult = "failed";
              terminalLedgerResultNote = truncateResultNote(reason);
              yield* Effect.annotateCurrentSpan({ "stripe.webhook_result": "failed" });
              yield* Effect.logWarning("Stripe webhook record failed permanently", {
                eventId: event.id,
                eventType: event.type,
                resultNote: terminalLedgerResultNote,
              });
              return ack(false);
            });

          const recordInput: StripeRecordInput = {
            configuration,
            event,
            mode,
            project,
            providerEnvironment,
            receivedAt: input.receivedAt,
            source: "webhook",
            stripeContext,
          };

          /**
           * Coerce a record success into `ack(true)`, park on product-not-mapped
           * (store the raw body for replay once the mapping is created), and
           * collapse terminal record failures into a `"failed"` ledger row.
           * Generic over the record method's error channel — narrowed with tag
           * guards (not `catchTag`, which would widen `R` to `unknown`).
           */
          const handled = <A, E, R>(
            recordEffect: Effect.Effect<A, E | StripePaymentProviderProductNotMappedError, R>,
          ) =>
            recordEffect.pipe(
              Effect.as(ack(true)),
              Effect.catchIf(
                (error): error is StripePaymentProviderProductNotMappedError =>
                  Predicate.hasProperty(error, "_tag") &&
                  error._tag === "StripePaymentProviderProductNotMappedError",
                (error) =>
                  Effect.gen(function* () {
                    yield* Effect.annotateCurrentSpan({
                      "stripe.webhook_result": "parked_pending_product_mapping",
                    });
                    yield* Effect.logInfo("Stripe webhook parked: product not yet mapped", {
                      eventId: event.id,
                      eventType: event.type,
                      providerProductKey: error.providerProductKey,
                    });
                    yield* queries.insertNotificationProcessedIfAbsent({
                      id: generateId("paymentProviderNotification"),
                      notificationSubtype: null,
                      notificationType: event.type,
                      notificationUuid: event.id,
                      parkedRawPayload: input.rawBody,
                      parkedUntilProviderProductKey: error.providerProductKey,
                      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                      providerId: "stripe",
                      result: "parked_pending_product_mapping",
                      resultNote: `product key ${error.providerProductKey} not mapped at event time`,
                      source: "webhook",
                    });
                    return ack(true);
                  }),
              ),
              Effect.catchIf(isTerminalRecordFailure, (error) =>
                markTerminalRecordFailure(describeRecordFailure(error)),
              ),
            );

          const matchResult = (yield* Match.value(event.type).pipe(
            Match.when(StripeEventType.InvoicePaid, () =>
              handled(stripePaymentProvider.recordInvoicePaid(recordInput)),
            ),
            Match.when(StripeEventType.InvoicePaymentFailed, () =>
              handled(stripePaymentProvider.recordInvoicePaymentFailed(recordInput)),
            ),
            Match.when(StripeEventType.CustomerSubscriptionUpdated, () =>
              handled(stripePaymentProvider.recordSubscriptionUpdated(recordInput)),
            ),
            Match.when(StripeEventType.CustomerSubscriptionDeleted, () =>
              handled(stripePaymentProvider.recordSubscriptionDeleted(recordInput)),
            ),
            Match.when(StripeEventType.CheckoutSessionCompleted, () =>
              handled(stripePaymentProvider.recordCheckoutSessionCompleted(recordInput)),
            ),
            Match.when(StripeEventType.ChargeRefunded, () =>
              handled(stripePaymentProvider.recordChargeRefunded(recordInput)),
            ),
            Match.when(StripeEventType.ChargeRefundUpdated, () =>
              handled(stripePaymentProvider.recordRefundUpdated(recordInput)),
            ),
            Match.when(StripeEventType.ChargeDisputeClosed, () =>
              handled(stripePaymentProvider.recordDisputeClosed(recordInput)),
            ),
            Match.orElse(() => Effect.succeed(ack(false))),
          )) as StripeAcceptWebhookEventResult;

          // Wire-level dedup ledger: one row per Stripe `event.id`, regardless of
          // routing. UNIQUE on (configurationId, event.id) makes a duplicate
          // delivery a no-op insert and leaves an earlier parked row's result
          // untouched.
          yield* queries.insertNotificationProcessedIfAbsent({
            id: generateId("paymentProviderNotification"),
            notificationSubtype: null,
            notificationType: event.type,
            notificationUuid: event.id,
            parkedRawPayload: null,
            parkedUntilProviderProductKey: null,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerId: "stripe",
            result: terminalLedgerResult ?? (matchResult.handled ? "applied" : "ignored"),
            resultNote: terminalLedgerResultNote,
            source: "webhook",
          });

          yield* Effect.annotateCurrentSpan({
            "stripe.webhook_result":
              terminalLedgerResult ?? (matchResult.handled ? "applied" : "ignored"),
          });
          return matchResult;
        },
        // Collapse every internal failure into the single public error, stamping
        // the routing `kind`. Product-not-mapped and terminal record failures
        // are handled inside the match (parked / "failed" ledger row) and never
        // reach here.
        (effect) => effect.pipe(Effect.catch((error) => Effect.fail(toStripeServiceError(error)))),
      );

      /**
       * Replays parked notifications for a `(configurationId, providerProductKey)`
       * mapping after the operator creates/activates it. Each parked raw body is
       * re-run through `acceptWebhookEvent({ isReplay: true })`; the per-event
       * `purchase_ledger` idempotency gate keeps the replay safe against any
       * live event for the same logical transaction. Returns counts for logging.
       */
      const replayParkedNotificationsForProductMapping = Effect.fn(
        "replayParkedNotificationsForProductMapping",
      )(function* (input: {
        readonly paymentProviderConfigurationId: string;
        readonly providerProductKey: string;
      }) {
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.configuration_id",
          input.paymentProviderConfigurationId,
        );
        yield* Effect.annotateCurrentSpan(
          "voidhash.payment_provider.provider_product_key",
          input.providerProductKey,
        );
        const parked = yield* queries.findParkedNotifications({
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
          providerProductKey: input.providerProductKey,
        });
        let appliedCount = 0;
        let failedCount = 0;
        for (const row of parked) {
          const rawPayload = row.parkedRawPayload;
          if (typeof rawPayload !== "string") {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: "parked_raw_payload missing or not a string",
            });
            failedCount++;
            continue;
          }
          const replayed = yield* acceptWebhookEvent({
            isReplay: true,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            rawBody: rawPayload,
            receivedAt: new Date(),
            signatureHeader: "",
          }).pipe(
            Effect.match({
              onFailure: (error) => ({ error: String(error), ok: false as const }),
              onSuccess: () => ({ ok: true as const }),
            }),
          );
          if (replayed.ok) {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "applied",
              resultNote: null,
            });
            appliedCount++;
          } else {
            yield* queries.markParkedNotificationResolved({
              id: row.id,
              result: "failed",
              resultNote: replayed.error.slice(0, 500),
            });
            failedCount++;
          }
        }
        yield* Effect.annotateCurrentSpan({
          "stripe.failed_count": failedCount,
          "stripe.total_count": parked.length,
        });
        return { appliedCount, failedCount, totalParked: parked.length };
      });

      return { acceptWebhookEvent, replayParkedNotificationsForProductMapping } as const;
    }),
  },
) {
  static layer = Layer.effect(StripeWebhookHandlerService)(StripeWebhookHandlerService.make).pipe(
    Layer.provideMerge(StripePaymentProvider.layer),
  );
}
