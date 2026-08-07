/**
 * Unit tests for {@link buildStripeContext}'s `verifyAndDecodeEvent` — the
 * hand-rolled `Stripe-Signature` HMAC verifier (`stripe/sdk-context.ts`).
 *
 * Unlike the App Store SDK context (which closes over a real Apple JWS verifier
 * with a CA-rooted cert chain that cannot be produced offline), the Stripe
 * scheme is a plain HMAC-SHA256 over `${t}.${rawBody}` keyed on the per-tenant
 * signing secret. That is fully reproducible in-process, so every verification
 * branch runs as a real test: the live/test secret discrimination (which secret
 * verifies determines `mode`), wrong-secret rejection, timestamp-tolerance
 * rejection + its `skipTimestampTolerance` bypass, and malformed-header
 * rejection.
 *
 * The REST enrichment helpers (`fetchChargeFeeMinor`, etc.) are NOT exercised
 * here — a fake `HttpClient` returning `{}` for any request satisfies the type
 * but is never called on the verify path. The signer is shared with the
 * integration suite via `signStripePayload` in the test-support module (it
 * mirrors the verifier's HMAC byte-for-byte), so unit and integration agree on
 * the wire format.
 */
import { Clock, Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";

import { StripeWebhookSignatureError } from "./errors.ts";
import { buildStripeContext } from "./sdk-context.ts";

/**
 * In-process HMAC signer mirroring the verifier byte-for-byte. Inlined (rather
 * than imported from the integration test-support module) so this unit test
 * carries no `@testing/*`-aliased / harness dependency under the unit runner.
 */
const signStripePayload = (
  rawBody: string,
  secret: string,
  timestampSeconds: number,
): Effect.Effect<string> =>
  Effect.gen(function* () {
    const encoder = new TextEncoder();
    const key = yield* Effect.promise(() =>
      crypto.subtle.importKey("raw", encoder.encode(secret), { hash: "SHA-256", name: "HMAC" }, false, [
        "sign",
      ]),
    );
    const signature = yield* Effect.promise(() =>
      crypto.subtle.sign("HMAC", key, encoder.encode(`${timestampSeconds}.${rawBody}`)),
    );
    const hex = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `t=${timestampSeconds},v1=${hex}`;
  });

const LIVE_WEBHOOK_SECRET = "whsec_live_unitsecret";
const TEST_WEBHOOK_SECRET = "whsec_test_unitsecret";

/** Stripe's replay-protection window; the stale-timestamp case steps well past it. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * A fake `HttpClient` returning `{}` with 200 for any request. The REST helpers
 * are not exercised by `verifyAndDecodeEvent`, so this only needs to satisfy the
 * `StripeContextConfig.httpClient` type.
 */
const stubHttpClient = (): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.sync(() =>
      HttpClientResponse.fromWeb(
        request,
        new Response("{}", { headers: { "Content-Type": "application/json" }, status: 200 }),
      ),
    ),
  );

/** Builds a context over the two unit-test webhook secrets + a no-op REST client. */
const makeContext = () =>
  buildStripeContext({
    httpClient: stubHttpClient(),
    liveSecretKey: "sk_live_unitkey",
    liveWebhookSecret: LIVE_WEBHOOK_SECRET,
    testSecretKey: "sk_test_unitkey",
    testWebhookSecret: TEST_WEBHOOK_SECRET,
  });

/** Serializes an event envelope to the exact JSON body that gets signed. */
const encodeJsonBody = Schema.encodeSync(Schema.UnknownFromJsonString);

/** A minimal but schema-valid Stripe event envelope, JSON-stringified. */
const eventBody = (overrides: Record<string, unknown> = {}): string =>
  encodeJsonBody({
    created: 1_700_000_000,
    data: { object: { id: "in_unit", object: "invoice" } },
    id: "evt_unit_1",
    livemode: false,
    object: "event",
    type: "invoice.paid",
    ...overrides,
  });

const nowSeconds = Effect.map(Clock.currentTimeMillis, (millis) => Math.floor(millis / 1000));

describe("buildStripeContext.verifyAndDecodeEvent", () => {
  it.effect("verifies a LIVE-secret signature and reports mode='live'", () =>
    Effect.gen(function* () {
      const context = makeContext();
      const rawBody = eventBody({ id: "evt_live_ok", livemode: true });
      const ts = yield* nowSeconds;
      const signatureHeader = yield* signStripePayload(rawBody, LIVE_WEBHOOK_SECRET, ts);

      const result = yield* context.verifyAndDecodeEvent({ rawBody, signatureHeader });

      expect(result.mode).toBe("live");
      expect(result.event.id).toBe("evt_live_ok");
      expect(result.event.type).toBe("invoice.paid");
    }),
  );

  it.effect("verifies a TEST-secret signature and reports mode='test'", () =>
    Effect.gen(function* () {
      const context = makeContext();
      const rawBody = eventBody({ id: "evt_test_ok" });
      const ts = yield* nowSeconds;
      const signatureHeader = yield* signStripePayload(rawBody, TEST_WEBHOOK_SECRET, ts);

      const result = yield* context.verifyAndDecodeEvent({ rawBody, signatureHeader });

      expect(result.mode).toBe("test");
      expect(result.event.id).toBe("evt_test_ok");
    }),
  );

  it.effect("rejects a signature produced with neither configured secret", () =>
    Effect.gen(function* () {
      const context = makeContext();
      const rawBody = eventBody();
      const ts = yield* nowSeconds;
      // Sign with a secret that matches neither the live nor the test webhook key.
      const signatureHeader = yield* signStripePayload(rawBody, "whsec_wrong", ts);

      const error = yield* Effect.flip(context.verifyAndDecodeEvent({ rawBody, signatureHeader }));

      expect(error).toBeInstanceOf(StripeWebhookSignatureError);
      expect(error.reason).toContain("no signature matched");
    }),
  );

  it.effect("rejects a stale timestamp outside the tolerance window", () =>
    Effect.gen(function* () {
      const context = makeContext();
      const rawBody = eventBody({ id: "evt_stale" });
      // A valid signature, but the timestamp is well past the 300s window.
      const staleTs = (yield* nowSeconds) - (SIGNATURE_TOLERANCE_SECONDS + 10_000);
      const signatureHeader = yield* signStripePayload(rawBody, LIVE_WEBHOOK_SECRET, staleTs);

      const error = yield* Effect.flip(context.verifyAndDecodeEvent({ rawBody, signatureHeader }));

      expect(error).toBeInstanceOf(StripeWebhookSignatureError);
      expect(error.reason).toContain("tolerance");
    }),
  );

  it.effect("accepts the SAME stale-but-signed payload when skipTimestampTolerance is set", () =>
    Effect.gen(function* () {
      const context = makeContext();
      const rawBody = eventBody({ id: "evt_stale_skip", livemode: true });
      const staleTs = (yield* nowSeconds) - (SIGNATURE_TOLERANCE_SECONDS + 10_000);
      const signatureHeader = yield* signStripePayload(rawBody, LIVE_WEBHOOK_SECRET, staleTs);

      // Same stale payload that was rejected above; skipping the freshness window
      // (the replay path) still checks the HMAC, so it verifies and decodes.
      const result = yield* context.verifyAndDecodeEvent({
        rawBody,
        signatureHeader,
        skipTimestampTolerance: true,
      });

      expect(result.mode).toBe("live");
      expect(result.event.id).toBe("evt_stale_skip");
    }),
  );

  it.effect("rejects a header with no v1 signature component", () =>
    Effect.gen(function* () {
      const context = makeContext();
      const rawBody = eventBody();
      // A `t=` with no `v1=` — the verifier requires at least one v1 signature.
      const signatureHeader = `t=${yield* nowSeconds}`;

      const error = yield* Effect.flip(context.verifyAndDecodeEvent({ rawBody, signatureHeader }));

      expect(error).toBeInstanceOf(StripeWebhookSignatureError);
      expect(error.reason).toContain("missing t/v1");
    }),
  );
});
