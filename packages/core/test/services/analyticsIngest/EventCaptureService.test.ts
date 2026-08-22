import { DateTime, Effect } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import { hashKey } from "../../../src/services/apiKeys/api-keys.ts";
import {
  isPublishableLookupKey,
  isSecretCaptureToken,
  resolveCaptureCredential,
  resolveEventTimestamp,
  tokenSuffix,
  validateCaptureToken,
} from "../../../src/services/analyticsIngest/EventCaptureService.ts";

/**
 * Token handling is the authorization boundary of the capture endpoints, so it
 * is covered here as pure `Effect`s (no Db) — the database-backed half lives in
 * `services/analytics/CommunityPostgresAnalytics.integration.test.ts`.
 */

const PUBLISHABLE = "vh_pk_AbCdEfGhIjKlMnOpQrStUvWxYzAbCd";
const SECRET = "vh_sk_AbCdEfGhIjKlMnOpQrStUvWxYzAbCd";

/** Run an effect expected to fail, returning the `CaptureUnauthorizedError`. */
const expectUnauthorized = (effect: Effect.Effect<unknown, { code: string; error: string }>) =>
  Effect.flip(effect);

describe("validateCaptureToken", () => {
  it.effect("accepts a publishable key and returns it trimmed", () =>
    Effect.gen(function* () {
      expect(yield* validateCaptureToken(`  ${PUBLISHABLE}  `)).toBe(PUBLISHABLE);
    }),
  );

  it.effect("accepts a secret key and returns it trimmed", () =>
    Effect.gen(function* () {
      expect(yield* validateCaptureToken(`\t${SECRET}\n`)).toBe(SECRET);
    }),
  );

  it.effect("fails with `missing token` for an empty token", () =>
    Effect.gen(function* () {
      const error = yield* expectUnauthorized(validateCaptureToken(""));
      expect(error.code).toBe("unauthorized");
      expect(error.error).toBe("missing token");
    }),
  );

  it.effect("fails with `missing token` for a whitespace-only token", () =>
    Effect.gen(function* () {
      const error = yield* expectUnauthorized(validateCaptureToken("   "));
      expect(error.error).toBe("missing token");
    }),
  );

  it.effect("fails with `invalid token format` for unknown prefixes and garbage", () =>
    Effect.gen(function* () {
      for (const token of ["vh_xx_AbCdEf", "sk_AbCdEf", "vh_pk_", "vh_sk_", "vh_pk", "nonsense"]) {
        const error = yield* expectUnauthorized(validateCaptureToken(token));
        expect(error.code).toBe("unauthorized");
        expect(error.error).toBe("invalid token format");
      }
    }),
  );
});

describe("resolveCaptureCredential", () => {
  it.effect("looks a publishable key up verbatim against the public key rows", () =>
    Effect.gen(function* () {
      expect(yield* resolveCaptureCredential(PUBLISHABLE)).toEqual({
        isPublic: true,
        lookupKey: PUBLISHABLE,
      });
    }),
  );

  it.effect("looks a secret key up by its `hashKey` digest against the private key rows", () =>
    Effect.gen(function* () {
      const credential = yield* resolveCaptureCredential(SECRET);
      expect(credential.isPublic).toBe(false);
      expect(credential.lookupKey).toBe(yield* hashKey(SECRET));
      // The raw secret must never be the value carried onward — it ends up on
      // the analytics event row.
      expect(credential.lookupKey).not.toBe(SECRET);
    }),
  );

  it.effect("trims surrounding whitespace before hashing a secret key", () =>
    Effect.gen(function* () {
      const credential = yield* resolveCaptureCredential(`  ${SECRET}  `);
      expect(credential.lookupKey).toBe(yield* hashKey(SECRET));
    }),
  );

  it.effect("rejects an empty credential with `missing token`", () =>
    Effect.gen(function* () {
      const error = yield* expectUnauthorized(resolveCaptureCredential("  "));
      expect(error.error).toBe("missing token");
    }),
  );

  it.effect("rejects malformed credentials with `invalid token format`", () =>
    Effect.gen(function* () {
      for (const token of ["vh_xx_AbCdEf", "sk_AbCdEf", "garbage"]) {
        const error = yield* expectUnauthorized(resolveCaptureCredential(token));
        expect(error.error).toBe("invalid token format");
      }
    }),
  );
});

describe("isSecretCaptureToken", () => {
  it("recognizes a secret key, trimming surrounding whitespace", () => {
    expect(isSecretCaptureToken(SECRET)).toBe(true);
    expect(isSecretCaptureToken(`  ${SECRET}  `)).toBe(true);
  });

  it("rejects publishable keys, digests, and garbage", () => {
    expect(isSecretCaptureToken(PUBLISHABLE)).toBe(false);
    expect(isSecretCaptureToken("vh_sk_")).toBe(false);
    expect(isSecretCaptureToken("")).toBe(false);
  });
});

describe("isPublishableLookupKey", () => {
  it("recognizes a verbatim publishable key", () => {
    expect(isPublishableLookupKey(PUBLISHABLE)).toBe(true);
  });

  it.effect("classifies a secret-key digest as non-public, mirroring the stored row", () =>
    Effect.gen(function* () {
      // The processor keys its `api_key` lookup off this discriminant: the
      // envelope carries the digest for secret-key captures, which must land
      // on the isPublic=false side or the event dead-letters.
      const credential = yield* resolveCaptureCredential(SECRET);
      expect(isPublishableLookupKey(credential.lookupKey)).toBe(false);
      expect(isPublishableLookupKey(credential.lookupKey)).toBe(credential.isPublic);

      const publishable = yield* resolveCaptureCredential(PUBLISHABLE);
      expect(isPublishableLookupKey(publishable.lookupKey)).toBe(publishable.isPublic);
    }),
  );
});

describe("tokenSuffix", () => {
  it("returns the last four characters", () => {
    expect(tokenSuffix(SECRET)).toBe(SECRET.slice(-4));
  });
});

describe("resolveEventTimestamp", () => {
  const dateAt = (iso: string) => DateTime.toDateUtc(DateTime.makeUnsafe(iso));
  const receivedAt = dateAt("2026-08-22T12:00:02.000Z");
  const sentAt = dateAt("2026-08-22T12:00:01.000Z");
  const timestamp = dateAt("2026-08-22T12:00:00.000Z");

  it("prefers the event timestamp, then sent_at, then the receive time", () => {
    expect(resolveEventTimestamp({ receivedAt, sentAt, timestamp })).toBe(timestamp);
    expect(resolveEventTimestamp({ receivedAt, sentAt })).toBe(sentAt);
    expect(resolveEventTimestamp({ receivedAt })).toBe(receivedAt);
  });
});
