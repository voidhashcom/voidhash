/**
 * Apple App Store Server-to-Server notification endpoint —
 * `POST /api/v1/inbound-webhooks/apple-server-to-server/:paymentProviderConfigurationId`.
 *
 * Renamed from `/api/v1/webhook-endpoints/apple-server-to-server/…`, which collided with the
 * outbound `webhooks` management group. Only Apple calls this path, so the
 * cutover is a provider-console reconfiguration.
 *
 * Decodes the signed-payload envelope (`{ signedPayload: string }`) and
 * forwards to `AppStorePaymentProviderService.acceptServerNotification`,
 * which owns Apple JWS verification, transaction decoding, and dispatch to
 * the matching `record*` method. The JWS body itself is opaque at this layer.
 *
 * The backend supplies the public App Store provider and webhook-handler
 * engine. Terminal signature or payload failures are acknowledged by that
 * engine, while transient infrastructure failures surface as 500 so Apple can
 * retry delivery.
 */
import {
  AppStorePaymentProviderService,
  AppStorePaymentProviderServiceError,
} from "@voidhash/core-v2";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { appleServerToServerIngressRoute } from "./manifest.ts";
import { hasTag } from "../../runtime-boundary.ts";

const AppleServerToServerPathParams = Schema.Struct({
  paymentProviderConfigurationId: Schema.String,
});

/**
 * Wire shape of the Apple S2S notification envelope — a single JWS in
 * `signedPayload`. Mirrors `ResponseBodyV2Schema` from
 * `@voidhash/app-store-server-sdk`; inlined here so the new package
 * doesn't have to depend on that SDK just to decode the envelope.
 */
const AppleServerNotificationBody = Schema.Struct({
  signedPayload: Schema.String,
});

const decodeAppleServerNotificationBody = Schema.decodeUnknownEffect(
  AppleServerNotificationBody,
);

const invalidPayloadResponse = HttpServerResponse.json(
  { error: "Invalid Apple server notification payload" },
  { status: 400 },
);

const registerAppleServerToServerNotificationRoute = Effect.fn("registerAppleServerToServerNotificationRoute")(function* () {
  const router = yield* HttpRouter.HttpRouter;

  yield* router.add(
    appleServerToServerIngressRoute.method,
    appleServerToServerIngressRoute.path,
    Effect.fn("registerAppleServerToServerNotificationRoute")(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const pathParamsResult = yield* Effect.result(
        HttpRouter.schemaPathParams(AppleServerToServerPathParams),
      );

      if (hasTag(pathParamsResult, "Failure")) {
        return yield* invalidPayloadResponse;
      }

      const bodyResult = yield* Effect.result(
        request.json.pipe(Effect.flatMap(decodeAppleServerNotificationBody)),
      );

      if (hasTag(bodyResult, "Failure")) {
        return yield* invalidPayloadResponse;
      }

      const receivedAt = yield* DateTime.nowAsDate;
      const appStorePaymentProviderService = yield* AppStorePaymentProviderService;
      yield* appStorePaymentProviderService.acceptServerNotification({
        paymentProviderConfigurationId: pathParamsResult.success.paymentProviderConfigurationId,
        receivedAt,
        signedPayload: bodyResult.success.signedPayload,
      });

      yield* Effect.logInfo("Apple server-to-server notification accepted", {
        paymentProviderConfigurationId: pathParamsResult.success.paymentProviderConfigurationId,
        signedPayloadLength: bodyResult.success.signedPayload.length,
      });

      return yield* HttpServerResponse.json({ received: true }, { status: 202 });
    })().pipe(
      // The real handler resolves terminal failures (signature/verification/
      // parse/app-identifier mismatches) to `{ accepted: true, handled: false }`
      // — those reach the 202 ack above so Apple stops retrying. An
      // `AppStorePaymentProviderServiceError` with `kind: "not_found"` means
      // the configuration/project is gone (deleted or never existed) — answer
      // 404 so Apple's retry loop is not fed a retry-forever 500. Anything
      // else signals a TRANSIENT / infrastructure failure (config lookup, DB,
      // Apple 5xx), which must return 5xx so Apple re-delivers — never 501,
      // which Apple treats as terminal.
      Effect.catchTag(
        "AppStorePaymentProviderServiceError",
        (error: AppStorePaymentProviderServiceError) =>
          Effect.fn("registerAppleServerToServerNotificationRoute")(function* () {
            if (error.kind === "not_found") {
              yield* Effect.logWarning(
                "Apple server-to-server notification rejected: configuration not found",
                { cause: error.cause },
              );
              return yield* HttpServerResponse.json(
                { error: "Unknown payment provider configuration", received: false },
                { status: 404 },
              );
            }
            yield* Effect.logWarning(
              "Apple server-to-server notification failed transiently; signaling retry",
              { cause: error.cause },
            );
            return yield* HttpServerResponse.json(
              { error: "Apple server notification processing failed", received: false },
              { status: 500 },
            );
          })(),
      ),
      Effect.catch((error) =>
        Effect.fn("registerAppleServerToServerNotificationRoute")(function* () {
          yield* Effect.logError("Apple server-to-server notification error", error);
          return yield* HttpServerResponse.json(
            { error: "Apple server notification processing failed" },
            { status: 500 },
          );
        })(),
      ),
    ),
  );
})();

export const AppleServerToServerNotificationRouteLayer = Layer.effectDiscard(
  registerAppleServerToServerNotificationRoute,
);
