// oxlint-disable effect/noGlobals -- every `new Date(...)` below is a fixed test vector, not a clock read: the module under test takes `now` by injection and exposes `Date`-typed values, so these fixtures pin the signing instant and the skew around it. There is no Effect runtime in this suite for a Clock service to come from.

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  VoidhashWebhookVerificationError,
  WEBHOOK_EVENT_TYPES,
  constructWebhookEvent,
  verifyWebhookSignature,
} from "../src/index";
import {
  constructWebhookEvent as constructWebhookEventFromEffectEntrypoint,
  verifyWebhookSignature as verifyWebhookSignatureFromEffectEntrypoint,
} from "../src/effect";

const SECRET = `whsec_${"a1b2c3d4".repeat(8)}`;
const TIMESTAMP = "1750000000";
const NOW = new Date(Number(TIMESTAMP) * 1000);
const PAYLOAD = '{"personId":"person_123","distinctId":"user_123"}';

const sign = (payload: string, timestamp: string, secret = SECRET) =>
  `v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex")}`;

const SIGNATURE = sign(PAYLOAD, TIMESTAMP);

const headersFor = (overrides: Record<string, string | string[] | undefined> = {}) => ({
  "content-type": "application/json",
  "x-webhook-event": "person.created",
  "x-webhook-signature": SIGNATURE,
  "x-webhook-timestamp": TIMESTAMP,
  ...overrides,
});

const expectVerificationError = (run: () => unknown, reason: string) => {
  expect(run).toThrow(VoidhashWebhookVerificationError);
  expect(run).toThrow(expect.objectContaining({ reason }));
};

describe("verifyWebhookSignature", () => {
  it("accepts a signature produced by the server contract", () => {
    expect(
      verifyWebhookSignature({
        now: NOW,
        payload: PAYLOAD,
        secret: SECRET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifyWebhookSignature({
        now: NOW,
        payload: `${PAYLOAD} `,
        secret: SECRET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);
  });

  it("rejects a tampered signature and a mismatched secret", () => {
    const tampered = `v1=${"0".repeat(64)}`;

    expect(
      verifyWebhookSignature({
        now: NOW,
        payload: PAYLOAD,
        secret: SECRET,
        signature: tampered,
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);

    expect(
      verifyWebhookSignature({
        now: NOW,
        payload: PAYLOAD,
        secret: `${SECRET}_other`,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);
  });

  it("rejects an unknown signature scheme", () => {
    expect(
      verifyWebhookSignature({
        now: NOW,
        payload: PAYLOAD,
        secret: SECRET,
        signature: SIGNATURE.replace("v1=", "v2="),
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);
  });

  it("rejects a length-mismatched signature without throwing", () => {
    expect(
      verifyWebhookSignature({
        now: NOW,
        payload: PAYLOAD,
        secret: SECRET,
        signature: `${SIGNATURE}00`,
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);

    expect(
      verifyWebhookSignature({
        now: NOW,
        payload: PAYLOAD,
        secret: SECRET,
        signature: "v1=",
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);
  });

  it("rejects an expired timestamp", () => {
    expect(
      verifyWebhookSignature({
        now: new Date(NOW.getTime() + 301_000),
        payload: PAYLOAD,
        secret: SECRET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);
  });

  it("rejects a timestamp too far in the future", () => {
    expect(
      verifyWebhookSignature({
        now: new Date(NOW.getTime() - 301_000),
        payload: PAYLOAD,
        secret: SECRET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      }),
    ).toBe(false);
  });

  it("accepts skew inside the tolerance in both directions", () => {
    expect(
      verifyWebhookSignature({
        now: new Date(NOW.getTime() + 299_000),
        payload: PAYLOAD,
        secret: SECRET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      }),
    ).toBe(true);

    expect(
      verifyWebhookSignature({
        now: new Date(NOW.getTime() - 299_000),
        payload: PAYLOAD,
        secret: SECRET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
      }),
    ).toBe(true);

    expect(
      verifyWebhookSignature({
        now: new Date(NOW.getTime() + 3_600_000),
        payload: PAYLOAD,
        secret: SECRET,
        signature: SIGNATURE,
        timestamp: TIMESTAMP,
        toleranceSeconds: 7200,
      }),
    ).toBe(true);
  });

  it("rejects a malformed timestamp", () => {
    for (const timestamp of ["", "not-a-number", "-1750000000", "1750000000.5"]) {
      expect(
        verifyWebhookSignature({
          now: NOW,
          payload: PAYLOAD,
          secret: SECRET,
          signature: sign(PAYLOAD, timestamp),
          timestamp,
        }),
      ).toBe(false);
    }
  });
});

describe("constructWebhookEvent", () => {
  it("returns the parsed delivery for a valid request", () => {
    const event = constructWebhookEvent({
      headers: headersFor(),
      now: NOW,
      payload: PAYLOAD,
      secret: SECRET,
    });

    expect(event.type).toBe("person.created");
    expect(event.payload).toEqual({
      distinctId: "user_123",
      personId: "person_123",
    });
    expect(event.timestamp.toISOString()).toBe(NOW.toISOString());
  });

  it("looks headers up case-insensitively", () => {
    const event = constructWebhookEvent({
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": "purchase.completed",
        "X-Webhook-Signature": SIGNATURE,
        "X-Webhook-Timestamp": TIMESTAMP,
      },
      now: NOW,
      payload: PAYLOAD,
      secret: SECRET,
    });

    expect(event.type).toBe("purchase.completed");
  });

  it("accepts single-value array headers and rejects repeated ones", () => {
    const event = constructWebhookEvent({
      headers: headersFor({
        "x-webhook-event": ["subscription.renewed"],
        "x-webhook-signature": [SIGNATURE],
        "x-webhook-timestamp": [TIMESTAMP],
      }),
      now: NOW,
      payload: PAYLOAD,
      secret: SECRET,
    });

    expect(event.type).toBe("subscription.renewed");

    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor({ "x-webhook-signature": [SIGNATURE, SIGNATURE] }),
          now: NOW,
          payload: PAYLOAD,
          secret: SECRET,
        }),
      "missing_header",
    );

    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor({ "x-webhook-timestamp": [] }),
          now: NOW,
          payload: PAYLOAD,
          secret: SECRET,
        }),
      "missing_header",
    );
  });

  it("rejects requests missing any of the three signing headers", () => {
    for (const header of ["x-webhook-event", "x-webhook-signature", "x-webhook-timestamp"]) {
      expectVerificationError(
        () =>
          constructWebhookEvent({
            headers: headersFor({ [header]: undefined }),
            now: NOW,
            payload: PAYLOAD,
            secret: SECRET,
          }),
        "missing_header",
      );
    }
  });

  it("rejects a tampered body and a tampered signature", () => {
    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor(),
          now: NOW,
          payload: '{"personId":"person_456","distinctId":"user_123"}',
          secret: SECRET,
        }),
      "invalid_signature",
    );

    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor({ "x-webhook-signature": `v1=${"0".repeat(64)}` }),
          now: NOW,
          payload: PAYLOAD,
          secret: SECRET,
        }),
      "invalid_signature",
    );
  });

  it("rejects timestamps outside the tolerance in both directions", () => {
    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor(),
          now: new Date(NOW.getTime() + 301_000),
          payload: PAYLOAD,
          secret: SECRET,
        }),
      "timestamp_out_of_tolerance",
    );

    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor(),
          now: new Date(NOW.getTime() - 301_000),
          payload: PAYLOAD,
          secret: SECRET,
        }),
      "timestamp_out_of_tolerance",
    );

    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor({ "x-webhook-timestamp": "not-a-number" }),
          now: NOW,
          payload: PAYLOAD,
          secret: SECRET,
        }),
      "timestamp_out_of_tolerance",
    );
  });

  it("rejects a signed body that is not JSON", () => {
    const payload = "not json";

    expectVerificationError(
      () =>
        constructWebhookEvent({
          headers: headersFor({ "x-webhook-signature": sign(payload, TIMESTAMP) }),
          now: NOW,
          payload,
          secret: SECRET,
        }),
      "invalid_payload",
    );
  });

  it("passes unknown and test event names through untouched", () => {
    const testPing = constructWebhookEvent({
      headers: headersFor({ "x-webhook-event": "test.ping" }),
      now: NOW,
      payload: PAYLOAD,
      secret: SECRET,
    });
    const unknown = constructWebhookEvent({
      headers: headersFor({ "x-webhook-event": "entitlement.granted" }),
      now: NOW,
      payload: PAYLOAD,
      secret: SECRET,
    });

    expect(testPing.type).toBe("test.ping");
    expect(unknown.type).toBe("entitlement.granted");
    expect(WEBHOOK_EVENT_TYPES).not.toContain("test.ping");
  });

  it("exposes the same helpers from the effect entrypoint", () => {
    expect(verifyWebhookSignatureFromEffectEntrypoint).toBe(verifyWebhookSignature);
    expect(constructWebhookEventFromEffectEntrypoint).toBe(constructWebhookEvent);
    expect([...WEBHOOK_EVENT_TYPES]).toEqual([
      "person.created",
      "person.updated",
      "person.deleted",
      "subscription.created",
      "subscription.renewed",
      "subscription.cancelled",
      "subscription.expired",
      "purchase.completed",
      "purchase.refunded",
    ]);
  });
});
