/**
 * Google Play Real-Time Developer Notification (RTDN) endpoint —
 * `POST /api/v1/inbound-webhooks/google-play-rtdn/:paymentProviderConfigurationId`.
 *
 * Renamed from `/api/v1/webhook-endpoints/google-play-rtdn/…`, which collided with the
 * outbound `webhooks` management group. Only Google calls this path, so the
 * cutover is a provider-console reconfiguration.
 *
 * Google delivers RTDN through a Pub/Sub PUSH subscription, so the HTTP body is
 * a Pub/Sub envelope (`{ message: { data: base64(DeveloperNotification), ... } }`).
 * This handler forwards the raw envelope to
 * `GooglePlayPaymentProviderService.acceptRtdnNotification`, which owns the
 * base64 decode, the authoritative Play API re-fetch, and dispatch to the
 * matching `record*` method.
 *
 * Ack semantics mirror Pub/Sub's retry contract: terminal/business outcomes
 * (bad envelope, unmapped product, verified-but-unhandled) are folded into a
 * 2xx ack so Pub/Sub stops redelivering; only a transient/infra failure
 * (`GooglePlayPaymentProviderServiceError`) returns 5xx so Pub/Sub re-delivers.
 */
import {
  GooglePlayPaymentProviderService,
  GooglePlayPaymentProviderServiceError,
} from "@voidhash/core/services";
import { pick } from "@voidhash/lib/lang";
import { DateTime, Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { GooglePubSubPushVerifier } from "../../GooglePubSubPushVerifier.ts";

const GooglePlayRtdnPathParamsSchema = Schema.Struct({
  paymentProviderConfigurationId: Schema.String,
});

const invalidPayloadResponse = HttpServerResponse.json(
  { error: "Invalid Google Play RTDN payload" },
  { status: 400 },
);

const registerGooglePlayRtdnNotificationRoute = Effect.gen(function* () {
  const router = yield* HttpRouter.HttpRouter;

  yield* router.add(
    "POST",
    "/api/v1/inbound-webhooks/google-play-rtdn/:paymentProviderConfigurationId",
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const pathParamsResult = yield* Effect.result(
        HttpRouter.schemaPathParams(GooglePlayRtdnPathParamsSchema),
      );

      if (pathParamsResult._tag === "Failure") {
        return yield* invalidPayloadResponse;
      }

      const pubSubPushVerifier = yield* GooglePubSubPushVerifier;
      const authenticationResult = yield* Effect.result(
        pubSubPushVerifier.verify(request.headers.authorization),
      );
      if (authenticationResult._tag === "Failure") {
        const error = authenticationResult.failure;
        const status = pick(error.kind === "misconfigured", 503, 401);
        yield* Effect.logWarning("Google Play RTDN caller authentication failed", {
          kind: error.kind,
          paymentProviderConfigurationId: pathParamsResult.success.paymentProviderConfigurationId,
        });
        return yield* HttpServerResponse.json(
          { error: "Google Play RTDN caller authentication failed", received: false },
          { status },
        );
      }

      // The Pub/Sub envelope shape is validated inside the service (it owns the
      // base64/RTDN decode); here we only need the parsed JSON body.
      const bodyResult = yield* Effect.result(request.json);
      if (bodyResult._tag === "Failure") {
        return yield* invalidPayloadResponse;
      }

      const receivedAt = yield* DateTime.nowAsDate;
      const googlePlayPaymentProviderService = yield* GooglePlayPaymentProviderService;
      const result = yield* googlePlayPaymentProviderService.acceptRtdnNotification({
        paymentProviderConfigurationId: pathParamsResult.success.paymentProviderConfigurationId,
        pubsubBody: bodyResult.success,
        receivedAt,
      });

      yield* Effect.logInfo("Google Play RTDN notification accepted", {
        handled: result.handled,
        notificationType: result.notificationType,
        paymentProviderConfigurationId: pathParamsResult.success.paymentProviderConfigurationId,
      });

      // 204 acks the Pub/Sub delivery (terminal + handled outcomes both ack).
      return yield* HttpServerResponse.json({ received: true }, { status: 200 });
    }).pipe(
      // The service folds terminal/business outcomes into a success value, so a
      // `GooglePlayPaymentProviderServiceError` signals a TRANSIENT/infra failure
      // (config lookup, DB, Play 5xx/rate-limit) — return 5xx so Pub/Sub
      // re-delivers. Never return a status Pub/Sub would treat differently for a
      // transient error.
      Effect.catchTag(
        "GooglePlayPaymentProviderServiceError",
        (error: GooglePlayPaymentProviderServiceError) =>
          Effect.gen(function* () {
            yield* Effect.logWarning(
              "Google Play RTDN notification failed transiently; signaling retry",
              { cause: error.cause },
            );
            return yield* HttpServerResponse.json(
              { error: "Google Play RTDN processing failed", received: false },
              { status: 500 },
            );
          }),
      ),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* Effect.logError("Google Play RTDN notification error", error);
          return yield* HttpServerResponse.json(
            { error: "Google Play RTDN processing failed" },
            { status: 500 },
          );
        }),
      ),
    ),
  );
});

export const GooglePlayRtdnNotificationRouteLayer = Layer.effectDiscard(
  registerGooglePlayRtdnNotificationRoute,
);
