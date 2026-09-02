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
import { generateId } from "@voidhash/core/utils";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";

import { constant, stringOr } from "@voidhash/lib/lang";

import type { PurchaseProcessingResult } from "@voidhash/core-v2";
import {
  StripePaymentProviderConfigurationNotFoundError,
  StripePaymentProviderProductNotMappedError,
  StripePaymentProviderTransactionNotFoundError,
  StripePaymentProviderProjectNotFoundError,
  StripePaymentProviderServiceError,
  StripeWebhookSignatureError,
} from "./errors.ts";
import type { StripeAcceptWebhookEventResult } from "@voidhash/core-v2";
import { decodeStripeEvent, StripeEventType } from "./events.ts";
import { StripePaymentProvider, type StripeRecordInput } from "./payment-provider.ts";
import { StripePaymentProviderServiceQueries } from "./payment-provider-service-queries.ts";
import type { StripeContext, StripeMode } from "./sdk-context.ts";
import { ProviderEnvironment, type ProviderEnvironmentValue } from "@voidhash/db";
import { MutableSet } from "../../../collection-boundary.ts";
import { hasTag } from "../../../runtime-boundary.ts";

const truncateResultNote = (note: string): string => note.slice(0, 500);

/** Tags `handled` collapses into a terminal "failed" ledger row (permanent, don't retry). */
const TERMINAL_RECORD_FAILURE_TAGS = new MutableSet<string>([
  "StripePurchaseProcessingIdempotencyKeyDerivationError",
  "InvalidISO4217CurrencyCodeError",
]);

/** Parses a parked (already signature-verified) webhook body as arbitrary JSON. */
const decodeJsonBody = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));

/**
 * Envelope stored in `parked_raw_payload` for Stripe parks. Carries the mode
 * the live ingress verified via the matched signing secret so a replay reuses
 * it instead of re-deriving from `event.livemode` (which could disagree and
 * flip `providerEnvironment` between park and replay). Legacy rows hold the
 * bare raw-body string; {@link resolveParkedStripePayload} accepts both.
 */
const ParkedStripeEnvelope = Schema.Struct({
  rawBody: Schema.String,
  verifiedMode: Schema.Literals(["live", "test"]),
});
const decodeParkedStripeEnvelope = Schema.decodeUnknownOption(ParkedStripeEnvelope);

const resolveParkedStripePayload = (
  parkedRawPayload: unknown,
):
  | { readonly rawBody: string; readonly verifiedMode?: StripeMode }
  | typeof Schema.Undefined.Type => {
  if (P.isString(parkedRawPayload)) return { rawBody: parkedRawPayload };
  const envelope = decodeParkedStripeEnvelope(parkedRawPayload);
  if (Option.isSome(envelope)) return envelope.value;
  return undefined;
};

/** Coerces `error[key]` to a string, falling back when the property is absent. */
const propertyOr = <K extends string>(error: unknown, key: K, fallback: string): string => {
  if (P.hasProperty(error, key)) return String(error[key]);
  return fallback;
};

/** Reads `error[key]` when it is a string, falling back otherwise. */
const stringPropertyOr = <K extends string>(error: unknown, key: K, fallback: string): string => {
  if (P.hasProperty(error, key)) return stringOr(error[key], fallback);
  return fallback;
};

/** Stripe stamps `livemode: false` on test-mode events. */
const stripeModeFromLivemode = (livemode: unknown): StripeMode => {
  if (livemode === false) return "test";
  return "live";
};

const providerEnvironmentForMode = (mode: StripeMode): ProviderEnvironmentValue => {
  if (mode === "test") return ProviderEnvironment.Sandbox;
  return ProviderEnvironment.Production;
};

/** The wire-dedup ledger `result` for this delivery. */
const ledgerResultOf = (
  terminalResult: "failed" | typeof Schema.Undefined.Type,
  handled: boolean,
): "failed" | "applied" | "ignored" => {
  if (terminalResult) return terminalResult;
  if (handled) return "applied";
  return "ignored";
};

const isTerminalRecordFailure = (error: unknown): boolean =>
  P.hasProperty(error, "_tag") &&
  P.isString(error._tag) &&
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
  const cause = stringPropertyOr(error, "cause", String(error));
  return new StripePaymentProviderServiceError({ cause, kind: "transient" });
};

const describeRecordFailure = (error: unknown): string => {
  if (
    P.hasProperty(error, "_tag") &&
    hasTag(error, "StripePurchaseProcessingIdempotencyKeyDerivationError")
  ) {
    const eventType = propertyOr(error, "eventType", "unknown");
    const missingField = propertyOr(error, "missingField", "unknown");
    return `idempotency key derivation failed for ${eventType}: missing ${missingField}`;
  }
  return `invalid ISO 4217 currency code: ${String(error)}`;
};

export class StripeWebhookHandlerService extends Context.Service<StripeWebhookHandlerService>()(
  "@voidhash/backend/purchases/StripeWebhookHandlerService",
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
          /**
           * Replay only: the mode the live ingress verified via its matched
           * signing secret. Without it a replay falls back to
           * `event.livemode`.
           */
          readonly verifiedMode?: StripeMode;
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
          // stored body (the signature header is not persisted) and reuses the
          // park-time verified mode, falling back to `livemode` only for
          // legacy parked rows that predate the envelope format.
          const resolveEvent = () => {
            if (input.isReplay) {
              return Effect.fn("resolveEvent")(function* () {
                const parsed = yield* decodeJsonBody(input.rawBody).pipe(
                  Effect.mapError(
                    (error) =>
                      new StripePaymentProviderServiceError({
                        cause: `parked Stripe payload is not valid JSON: ${error.message}`,
                      }),
                  ),
                );
                const decoded = yield* decodeStripeEvent(parsed);
                return {
                  event: decoded,
                  mode: input.verifiedMode ?? stripeModeFromLivemode(decoded.livemode),
                };
              })();
            }
            return stripeContext.verifyAndDecodeEvent({
              rawBody: input.rawBody,
              signatureHeader: input.signatureHeader,
              skipTimestampTolerance: false,
            });
          };
          const { event, mode } = yield* resolveEvent();

          yield* Effect.annotateCurrentSpan("voidhash.payment_provider.event_type", event.type);
          yield* Effect.annotateCurrentSpan("voidhash.webhook.id", event.id);

          const providerEnvironment = providerEnvironmentForMode(mode);
          const providerOccurredAt =
            event.created === undefined
              ? input.receivedAt
              : DateTime.toDateUtc(DateTime.makeUnsafe(event.created * 1_000));

          const ack = (handled: boolean): StripeAcceptWebhookEventResult => ({
            accepted: true,
            eventId: event.id,
            eventType: event.type,
            handled,
          });

          const terminalLedger: {
            result: "failed" | typeof Schema.Undefined.Type;
            resultNote: string | typeof Schema.Null.Type;
          } = { result: undefined, resultNote: null };

          const markTerminalRecordFailure = (reason: string) =>
            Effect.fn("markTerminalRecordFailure")(function* () {
              terminalLedger.result = "failed";
              terminalLedger.resultNote = truncateResultNote(reason);
              yield* Effect.annotateCurrentSpan({ "stripe.webhook_result": "failed" });
              yield* Effect.logWarning("Stripe webhook record failed permanently", {
                eventId: event.id,
                eventType: event.type,
                resultNote: terminalLedger.resultNote,
              });
              return ack(false);
            })();

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
          const handled = <E, R>(
            recordEffect: Effect.Effect<
              PurchaseProcessingResult,
              | E
              | StripePaymentProviderProductNotMappedError
              | StripePaymentProviderTransactionNotFoundError,
              R
            >,
          ) =>
            recordEffect.pipe(
              Effect.map((result) => ack(!result.isIgnored())),
              Effect.catchIf(
                (error): error is StripePaymentProviderProductNotMappedError =>
                  P.hasProperty(error, "_tag") &&
                  hasTag(error, "StripePaymentProviderProductNotMappedError"),
                (error) =>
                  Effect.fn("handled")(function* () {
                    yield* Effect.annotateCurrentSpan({
                      "stripe.webhook_result": "parked_pending_product_mapping",
                    });
                    yield* Effect.logInfo("Stripe webhook parked: product not yet mapped", {
                      eventId: event.id,
                      eventType: event.type,
                      providerProductKey: error.providerProductKey,
                    });
                    if (input.isReplay) {
                      return ack(false);
                    }
                    yield* queries.insertNotificationProcessedIfAbsent({
                      id: generateId("paymentProviderNotification"),
                      notificationSubtype: null,
                      notificationType: event.type,
                      notificationUuid: event.id,
                      parkedRawPayload: { rawBody: input.rawBody, verifiedMode: mode },
                      parkedUntilProviderProductKey: error.providerProductKey,
                      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                      providerId: "stripe",
                      providerOccurredAt,
                      result: "parked_pending_product_mapping",
                      resultNote: `product key ${error.providerProductKey} not mapped at event time`,
                      source: "webhook",
                    });
                    return ack(true);
                  })(),
              ),
              Effect.catchIf(
                (error): error is StripePaymentProviderTransactionNotFoundError =>
                  P.hasProperty(error, "_tag") &&
                  hasTag(error, "StripePaymentProviderTransactionNotFoundError"),
                (error) =>
                  Effect.fn("handled")(function* () {
                    if (input.isReplay) {
                      return ack(false);
                    }
                    yield* Effect.logInfo(
                      "Stripe webhook parked: original transaction not available yet",
                      {
                        candidateKeys: error.candidateKeys,
                        eventId: event.id,
                        eventType: event.type,
                      },
                    );
                    yield* queries.insertNotificationProcessedIfAbsent({
                      id: generateId("paymentProviderNotification"),
                      notificationSubtype: null,
                      notificationType: event.type,
                      notificationUuid: event.id,
                      parkedRawPayload: { rawBody: input.rawBody, verifiedMode: mode },
                      parkedUntilProviderProductKey: null,
                      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
                      providerId: "stripe",
                      providerOccurredAt,
                      result: "parked_pending_transaction",
                      resultNote: `waiting for original transaction: ${error.candidateKeys.join(", ")}`,
                      source: "webhook",
                    });
                    return ack(true);
                  })(),
              ),
              Effect.catchIf(isTerminalRecordFailure, (error) =>
                markTerminalRecordFailure(describeRecordFailure(error)),
              ),
            );

          const matchResult: StripeAcceptWebhookEventResult = yield* Match.value(event.type).pipe(
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
          );

          // Wire-level dedup ledger: one row per Stripe `event.id`, regardless of
          // routing. UNIQUE on (configurationId, event.id) makes a duplicate
          // delivery a no-op insert and leaves an earlier parked row's result
          // untouched.
          const ledgerResult = ledgerResultOf(terminalLedger.result, matchResult.handled);
          yield* queries.insertNotificationProcessedIfAbsent({
            id: generateId("paymentProviderNotification"),
            notificationSubtype: null,
            notificationType: event.type,
            notificationUuid: event.id,
            parkedRawPayload: null,
            parkedUntilProviderProductKey: null,
            paymentProviderConfigurationId: input.paymentProviderConfigurationId,
            providerId: "stripe",
            result: ledgerResult,
            resultNote: terminalLedger.resultNote,
            source: "webhook",
          });

          yield* Effect.annotateCurrentSpan({ "stripe.webhook_result": ledgerResult });
          return matchResult;
        },
        // Collapse every internal failure into the single public error, stamping
        // the routing `kind`. Product-not-mapped and terminal record failures
        // are handled inside the match (parked / "failed" ledger row) and never
        // reach here.
        (effect) => effect.pipe(Effect.catch((error) => Effect.fail(toStripeServiceError(error)))),
      );

      /** Replays Stripe events that arrived before their original transaction. */
      const replayParkedTransactionNotifications = Effect.fn(
        "replayParkedTransactionNotifications",
      )(function* (input: { readonly paymentProviderConfigurationId: string }) {
        const parked = yield* queries.findParkedTransactionNotifications(input);
        const results = yield* Effect.forEach(
          parked,
          Effect.fn("replayParkedStripeTransaction")(function* (row) {
            const parkedPayload = resolveParkedStripePayload(row.parkedRawPayload);
            if (parkedPayload === undefined) {
              yield* queries.markParkedNotificationResolved({
                id: row.id,
                result: "failed",
                resultNote: "parked_raw_payload missing or malformed",
              });
              return { appliedCount: 0, failedCount: 1 };
            }
            const replayed = yield* acceptWebhookEvent({
              isReplay: true,
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              rawBody: parkedPayload.rawBody,
              receivedAt: yield* DateTime.nowAsDate,
              signatureHeader: "",
              verifiedMode: parkedPayload.verifiedMode,
            }).pipe(
              Effect.match({
                onFailure: (error) => ({ error: String(error), ok: constant(false) }),
                onSuccess: (result) => ({ handled: result.handled, ok: constant(true) }),
              }),
            );
            if (replayed.ok && replayed.handled) {
              yield* queries.markParkedNotificationResolved({
                id: row.id,
                result: "applied",
                resultNote: null,
              });
              return { appliedCount: 1, failedCount: 0 };
            } else {
              const resultNote = replayed.ok
                ? "original transaction is still unavailable"
                : replayed.error;
              yield* queries.markParkedNotificationAttempted({
                id: row.id,
                resultNote,
              });
              return { appliedCount: 0, failedCount: 1 };
            }
          }),
          { concurrency: 1 },
        );
        return {
          appliedCount: Arr.reduce(results, 0, (count, result) => count + result.appliedCount),
          failedCount: Arr.reduce(results, 0, (count, result) => count + result.failedCount),
          totalParked: Arr.length(parked),
        };
      });

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
        const results = yield* Effect.forEach(
          parked,
          Effect.fn("replayParkedStripeProduct")(function* (row) {
            const parkedPayload = resolveParkedStripePayload(row.parkedRawPayload);
            if (parkedPayload === undefined) {
              yield* queries.markParkedNotificationResolved({
                id: row.id,
                result: "failed",
                resultNote: "parked_raw_payload missing or malformed",
              });
              return { appliedCount: 0, failedCount: 1 };
            }
            const receivedAt = yield* DateTime.nowAsDate;
            const replayed = yield* acceptWebhookEvent({
              isReplay: true,
              paymentProviderConfigurationId: input.paymentProviderConfigurationId,
              rawBody: parkedPayload.rawBody,
              receivedAt,
              signatureHeader: "",
              verifiedMode: parkedPayload.verifiedMode,
            }).pipe(
              Effect.match({
                onFailure: (error) => ({ error: String(error), ok: constant(false) }),
                onSuccess: (result) => ({ handled: result.handled, ok: constant(true) }),
              }),
            );
            if (replayed.ok && replayed.handled) {
              yield* queries.markParkedNotificationResolved({
                id: row.id,
                result: "applied",
                resultNote: null,
              });
              return { appliedCount: 1, failedCount: 0 };
            } else {
              const resultNote = replayed.ok
                ? "replay completed without applying purchase state"
                : replayed.error;
              yield* queries.markParkedNotificationAttempted({
                id: row.id,
                resultNote,
              });
              return { appliedCount: 0, failedCount: 1 };
            }
          }),
          { concurrency: 1 },
        );
        const appliedCount = Arr.reduce(results, 0, (count, result) => count + result.appliedCount);
        const failedCount = Arr.reduce(results, 0, (count, result) => count + result.failedCount);
        const dependent = yield* replayParkedTransactionNotifications({
          paymentProviderConfigurationId: input.paymentProviderConfigurationId,
        });
        const totalApplied = appliedCount + dependent.appliedCount;
        const totalFailed = failedCount + dependent.failedCount;
        const totalParked = parked.length + dependent.totalParked;
        yield* Effect.annotateCurrentSpan({
          "stripe.failed_count": totalFailed,
          "stripe.total_count": totalParked,
        });
        return { appliedCount: totalApplied, failedCount: totalFailed, totalParked };
      });

      return constant({
        acceptWebhookEvent,
        replayParkedNotificationsForProductMapping,
        replayParkedTransactionNotifications,
      });
    }),
  },
) {
  static layer = Layer.effect(StripeWebhookHandlerService)(StripeWebhookHandlerService.make).pipe(
    Layer.provideMerge(StripePaymentProvider.layer),
  );
}
