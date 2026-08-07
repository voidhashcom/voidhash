import {
  GooglePlayPaymentProviderService,
  type GooglePlayPaymentProviderServiceShape,
} from "@voidhash/core/services";
import { Effect, Encoding, Layer, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vite-plus/test";

import {
  GooglePubSubPushVerificationError,
  GooglePubSubPushVerifier,
  type GooglePubSubPushVerifierShape,
} from "../../GooglePubSubPushVerifier.ts";
import { GooglePlayRtdnNotificationRouteLayer } from "./google-play-rtdn.ts";

const path = "/api/v1/webhook-endpoints/google-play-rtdn/config-1";

const encodeRtdnPayload = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({ packageName: Schema.String, testNotification: Schema.Struct({}) }),
  ),
);

const PubSubPushBody = Schema.Struct({
  message: Schema.Struct({ data: Schema.String, messageId: Schema.String }),
});
const encodePubSubPushBody = Schema.encodeSync(Schema.fromJsonString(PubSubPushBody));

const body = {
  message: {
    data: Encoding.encodeBase64(
      encodeRtdnPayload({ packageName: "com.example", testNotification: {} }),
    ),
    messageId: "message-1",
  },
};

const serve = (
  authorization: string | undefined,
  verifier: GooglePubSubPushVerifierShape,
  onAccept: () => void,
) =>
  Effect.gen(function* () {
    const paymentProvider: GooglePlayPaymentProviderServiceShape = {
      acceptRtdnNotification: (input) =>
        Effect.sync(() => {
          onAccept();
          expect(input.paymentProviderConfigurationId).toBe("config-1");
          expect(input.pubsubBody).toEqual(body);
          return {
            accepted: true,
            handled: true,
            notificationType: "TEST",
            notificationUUID: undefined,
            subtype: undefined,
          };
        }),
      processSdkTransaction: () => Effect.die("not used"),
    };
    const dependencies = Layer.mergeAll(
      Layer.succeed(GooglePubSubPushVerifier, verifier),
      Layer.succeed(GooglePlayPaymentProviderService, paymentProvider),
    );
    const handler = yield* HttpRouter.toHttpEffect(
      GooglePlayRtdnNotificationRouteLayer.pipe(HttpRouter.provideRequest(dependencies)),
    );
    const headers = new Headers({ "content-type": "application/json" });
    if (authorization) {
      headers.set("authorization", authorization);
    }
    const response = yield* handler.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(
          new Request(`http://localhost${path}`, {
            body: encodePubSubPushBody(body),
            headers,
            method: "POST",
          }),
        ),
      ),
    );
    return HttpServerResponse.toWeb(response);
  }).pipe(Effect.scoped, Effect.runPromise);

describe("Google Play RTDN route authentication", () => {
  it("rejects an unauthenticated request before processing its body", () => {
    let acceptCalls = 0;
    return serve(
      undefined,
      {
        verify: () =>
          Effect.fail(
            new GooglePubSubPushVerificationError({
              kind: "unauthorized",
              message: "missing token",
            }),
          ),
      },
      () => {
        acceptCalls += 1;
      },
    ).then((response) => {
      expect(response.status).toBe(401);
      expect(acceptCalls).toBe(0);
    });
  });

  it("returns a retryable error when authenticated push is not configured", () => {
    let acceptCalls = 0;
    return serve(
      "Bearer token",
      {
        verify: () =>
          Effect.fail(
            new GooglePubSubPushVerificationError({
              kind: "misconfigured",
              message: "missing configuration",
            }),
          ),
      },
      () => {
        acceptCalls += 1;
      },
    ).then((response) => {
      expect(response.status).toBe(503);
      expect(acceptCalls).toBe(0);
    });
  });

  it("processes a request only after caller authentication succeeds", () => {
    let acceptCalls = 0;
    return serve("Bearer signed-token", { verify: () => Effect.void }, () => {
      acceptCalls += 1;
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(acceptCalls).toBe(1);
    });
  });
});
