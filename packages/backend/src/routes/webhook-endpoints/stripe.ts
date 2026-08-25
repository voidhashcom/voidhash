/**
 * Stripe webhook endpoint —
 * `POST /api/v1/inbound-webhooks/stripe/:paymentProviderConfigurationId`.
 *
 * Renamed from `/api/v1/webhook-endpoints/stripe/…`, which collided with the
 * outbound `webhooks` management group. Only Stripe calls this path, so the
 * cutover is a provider-console reconfiguration.
 *
 * Stripe signs the webhook with an HMAC over the EXACT raw request body, so
 * this handler reads `request.text` (never `request.json`) and forwards the raw
 * body + the `Stripe-Signature` header to
 * `StripePaymentProviderService.acceptWebhookEvent`, which owns verification,
 * decoding, and dispatch to the matching `record*` method.
 *
 * HTTP contract (Stripe retries on any non-2xx):
 *   - verified + handled / parked / permanently-unhandleable → 200 (stop retrying),
 *   - bad signature → 400 (permanent; visible in the Stripe dashboard),
 *   - unknown configuration/project → 404 (permanent),
 *   - transient infra failure (DB / Stripe API) → 500 (Stripe re-delivers).
 * The kind→status mapping is driven by `StripePaymentProviderServiceError.kind`.
 */
import {
  StripePaymentProviderService,
  StripePaymentProviderServiceError,
} from "@voidhash/core/services";
import { DateTime, Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

const StripeWebhookPathParamsSchema = Schema.Struct({
  paymentProviderConfigurationId: Schema.String,
});

const invalidPayloadResponse = HttpServerResponse.json(
  { error: "Invalid Stripe webhook request" },
  { status: 400 },
);

/** Maps the service failure kind onto the HTTP status Stripe should observe. */
const webhookErrorStatus = (kind: StripePaymentProviderServiceError["kind"]): number => {
  if (kind === "signature") return 400;
  if (kind === "not_found") return 404;
  return 500;
};

const registerStripeWebhookRoute = Effect.gen(function* () {
  const router = yield* HttpRouter.HttpRouter;

  yield* router.add(
    "POST",
    "/api/v1/inbound-webhooks/stripe/:paymentProviderConfigurationId",
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const pathParamsResult = yield* Effect.result(
        HttpRouter.schemaPathParams(StripeWebhookPathParamsSchema),
      );
      if (pathParamsResult._tag === "Failure") {
        return yield* invalidPayloadResponse;
      }

      const signatureHeader = request.headers["stripe-signature"] ?? "";
      if (!signatureHeader) {
        return yield* HttpServerResponse.json(
          { error: "Missing stripe-signature header" },
          { status: 400 },
        );
      }

      // Raw body bytes — Stripe's HMAC is computed over the exact payload, so we
      // must NOT parse/re-serialize before verification.
      const rawBody = yield* request.text;

      const receivedAt = yield* DateTime.nowAsDate;
      const stripePaymentProviderService = yield* StripePaymentProviderService;
      const result = yield* stripePaymentProviderService.acceptWebhookEvent({
        paymentProviderConfigurationId: pathParamsResult.success.paymentProviderConfigurationId,
        rawBody,
        receivedAt,
        signatureHeader,
      });

      yield* Effect.logInfo("Stripe webhook accepted", {
        eventId: result.eventId,
        eventType: result.eventType,
        handled: result.handled,
        paymentProviderConfigurationId: pathParamsResult.success.paymentProviderConfigurationId,
      });

      return yield* HttpServerResponse.json({ received: true }, { status: 200 });
    }).pipe(
      Effect.catchTag(
        "StripePaymentProviderServiceError",
        (error: StripePaymentProviderServiceError) =>
          Effect.gen(function* () {
            const status = webhookErrorStatus(error.kind);
            yield* Effect.logWarning("Stripe webhook processing failed", {
              cause: error.cause,
              kind: error.kind ?? "transient",
              status,
            });
            return yield* HttpServerResponse.json(
              { error: "Stripe webhook processing failed", received: false },
              { status },
            );
          }),
      ),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* Effect.logError("Stripe webhook error", error);
          return yield* HttpServerResponse.json(
            { error: "Stripe webhook processing failed" },
            { status: 500 },
          );
        }),
      ),
    ),
  );
});

export const StripeWebhookNotificationRouteLayer = Layer.effectDiscard(registerStripeWebhookRoute);
