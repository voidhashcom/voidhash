import { describe, expect, it } from "vite-plus/test";
import { Effect, Schema } from "effect";

import {
  buildFcmMessage,
  classifyFcmResult,
} from "../../../src/services/notifications/FirebaseCloudMessagingService.ts";
import {
  buildApnsPayload,
  classifyApnsResult,
} from "../../../src/services/notifications/ApplePushNotificationService.ts";
import {
  type PushDeliveryError,
  type PushDeliverySuccess,
  PushRateExceededError,
  PushTransientError,
} from "../../../src/services/notifications/push-delivery-provider.ts";
import { nextPushDeliveryDelaySeconds } from "../../../src/services/notifications/PushDeliveryService.ts";

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);
const decodeRecord = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown));
const decodeApns = Schema.decodeUnknownSync(
  Schema.Struct({
    headers: Schema.Record(Schema.String, Schema.String),
    payload: Schema.Struct({ aps: Schema.Record(Schema.String, Schema.Unknown) }),
  }),
);

/** Reads the optional `retryAfterSeconds` carried by the retryable push errors. */
const retryAfterSecondsOf = (error: PushDeliveryError): number | undefined => {
  if (error instanceof PushRateExceededError) return error.retryAfterSeconds;
  if (error instanceof PushTransientError) return error.retryAfterSeconds;
  return undefined;
};

/** Run a classify Effect to its success value (throws if it failed). */
const classifiedSuccess = (effect: Effect.Effect<PushDeliverySuccess, PushDeliveryError>) =>
  Effect.runSync(effect);
/** Run a classify Effect to its tagged error (throws if it succeeded). */
const classifiedError = (effect: Effect.Effect<PushDeliverySuccess, PushDeliveryError>) =>
  Effect.runSync(Effect.flip(effect));

/**
 * Pure coverage of the load-bearing classification/mapping logic. Misclassifying
 * an error is unforgiving (terminal-as-retryable burns quota on dead tokens;
 * transient-as-terminal silently deletes live devices), so every normalized
 * outcome is pinned here.
 */

describe("buildFcmMessage", () => {
  it("maps the unified message onto FCM v1 fields, stringifying data values", () => {
    const body = buildFcmMessage(
      "fcm-token-1",
      {
        title: "Hi",
        body: "There",
        data: { count: 3, tag: "promo" },
        priority: "high",
        sound: "ping",
        badge: 2,
        collapseId: "c1",
        channelId: "default",
      },
      { androidTtl: "3600s", apnsPriority: "10" },
    );

    const message = decodeRecord(body.message);
    expect(message.token).toBe("fcm-token-1");
    expect(message.notification).toEqual({ title: "Hi", body: "There" });
    // FCM rejects non-string data values.
    expect(message.data).toEqual({ count: "3", tag: "promo" });
    const android = decodeRecord(message.android);
    expect(android.priority).toBe("HIGH");
    expect(android.ttl).toBe("3600s");
    expect(android.collapse_key).toBe("c1");
    const apns = decodeApns(message.apns);
    expect(apns.headers["apns-priority"]).toBe("10");
    expect(apns.headers["apns-collapse-id"]).toBe("c1");
    expect(apns.payload.aps).toMatchObject({
      alert: { title: "Hi", body: "There" },
      sound: "ping",
      badge: 2,
    });
  });

  it("defaults android priority to NORMAL and omits data when absent", () => {
    const body = buildFcmMessage("t", { title: "a", body: "b" }, {});
    const message = decodeRecord(body.message);
    expect(decodeRecord(message.android).priority).toBe("NORMAL");
    expect(message.data).toBeUndefined();
  });
});

describe("classifyFcmResult", () => {
  it("treats 2xx as success and extracts the message name", () => {
    const result = classifiedSuccess(
      classifyFcmResult(200, encodeJson({ name: "projects/p/messages/123" })),
    );
    expect(result.statusCode).toBe(200);
    expect(result.providerMessageId).toBe("projects/p/messages/123");
  });

  it("maps FCM error codes to the normalized tagged errors", () => {
    const cases: ReadonlyArray<[number, string, string]> = [
      [404, "UNREGISTERED", "PushUnregisteredError"],
      [400, "INVALID_ARGUMENT", "PushBadTokenError"],
      [403, "SENDER_ID_MISMATCH", "PushBadTokenError"],
      [429, "QUOTA_EXCEEDED", "PushRateExceededError"],
      [401, "THIRD_PARTY_AUTH_ERROR", "PushInvalidCredentialsError"],
      [503, "UNAVAILABLE", "PushTransientError"],
      [500, "INTERNAL", "PushTransientError"],
    ];
    for (const [status, code, expectedTag] of cases) {
      const error = classifiedError(
        classifyFcmResult(
          status,
          encodeJson({ error: { status: code, details: [{ errorCode: code }] } }),
        ),
      );
      expect(error._tag).toBe(expectedTag);
      expect(error.statusCode).toBe(status);
    }
  });

  it("falls back on HTTP status when no error code is present", () => {
    expect(classifiedError(classifyFcmResult(503, ""))._tag).toBe("PushTransientError");
    expect(classifiedError(classifyFcmResult(404, ""))._tag).toBe("PushUnregisteredError");
    expect(classifiedError(classifyFcmResult(429, ""))._tag).toBe("PushRateExceededError");
  });

  it("propagates an explicit Retry-After onto the retryable error", () => {
    const error = classifiedError(
      classifyFcmResult(429, encodeJson({ error: { status: "QUOTA_EXCEEDED" } }), 120),
    );
    expect(error._tag).toBe("PushRateExceededError");
    expect(retryAfterSecondsOf(error)).toBe(120);
  });
});

describe("buildApnsPayload", () => {
  it("nests aps and merges custom data at the top level", () => {
    const payload = buildApnsPayload({
      title: "t",
      body: "b",
      sound: "default",
      badge: 5,
      data: { deep: "link" },
    });
    expect(payload.aps).toMatchObject({
      alert: { title: "t", body: "b" },
      sound: "default",
      badge: 5,
    });
    expect(payload.deep).toBe("link");
  });
});

describe("classifyApnsResult", () => {
  it("maps APNs reasons and statuses to the normalized tagged errors", () => {
    expect(classifiedSuccess(classifyApnsResult(200, "", "apns-id-1"))).toMatchObject({
      statusCode: 200,
      providerMessageId: "apns-id-1",
    });
    expect(
      classifiedError(classifyApnsResult(410, encodeJson({ reason: "Unregistered" })))._tag,
    ).toBe("PushUnregisteredError");
    expect(
      classifiedError(classifyApnsResult(400, encodeJson({ reason: "BadDeviceToken" })))._tag,
    ).toBe("PushBadTokenError");
    expect(
      classifiedError(classifyApnsResult(403, encodeJson({ reason: "ExpiredProviderToken" })))
        ._tag,
    ).toBe("PushInvalidCredentialsError");
    expect(
      classifiedError(classifyApnsResult(413, encodeJson({ reason: "PayloadTooLarge" })))._tag,
    ).toBe("PushPayloadTooLargeError");
    expect(
      classifiedError(classifyApnsResult(429, encodeJson({ reason: "TooManyRequests" })))._tag,
    ).toBe("PushRateExceededError");
    expect(classifiedError(classifyApnsResult(503, ""))._tag).toBe("PushTransientError");
  });
});

describe("nextPushDeliveryDelaySeconds", () => {
  it("follows the [10s,30s,5min,30min,2hr] schedule, clamped to the last step", () => {
    expect(nextPushDeliveryDelaySeconds(1)).toBe(10);
    expect(nextPushDeliveryDelaySeconds(2)).toBe(30);
    expect(nextPushDeliveryDelaySeconds(3)).toBe(300);
    expect(nextPushDeliveryDelaySeconds(4)).toBe(1800);
    expect(nextPushDeliveryDelaySeconds(5)).toBe(7200);
    expect(nextPushDeliveryDelaySeconds(99)).toBe(7200);
  });

  it("honors an explicit provider Retry-After over the schedule", () => {
    expect(nextPushDeliveryDelaySeconds(1, 45)).toBe(45);
    expect(nextPushDeliveryDelaySeconds(5, 0)).toBe(0);
  });
});
