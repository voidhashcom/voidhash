import { Effect } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import {
  createPublishableKey,
  createSecretKey,
  createUserApiKey,
  generatePublishableKey,
  generateSecretKey,
  generateUserApiKey,
  hashKey,
  KEY_END_LENGTH,
  PRODUCTION_PUBLISHABLE_KEY_PREFIX,
  PRODUCTION_SECRET_KEY_PREFIX,
} from "../../../src/services/apiKeys/api-keys.ts";

/**
 * Every function under test returns a pure `Effect` (no requirements), so each
 * case runs it with the `it.effect` helper from the local shim — mirroring
 * money.test.ts. Key generation is randomized, so the structural assertions
 * (length / prefix / `end` suffix) are deterministic while exact key content is
 * not asserted. `hashKey` IS deterministic so it gets an exact-value assertion.
 */

// base64url-no-padding alphabet — what `hashKey` is contractually expected to
// emit (URL-safe, never `+` `/` `=`).
const BASE64URL_NOPAD = /^[A-Za-z0-9_-]+$/;

// The two key bodies are built from the 52-letter (upper+lower) alphabet only.
const KEY_BODY_ALPHABET = /^[A-Za-z]+$/;

describe("hashKey", () => {
  it.effect("produces a SHA-256 digest as base64url without padding", () =>
    Effect.gen(function* () {
      // SHA-256("hello") base64url-no-pad, verified independently.
      const hashed = yield* hashKey("hello");
      expect(hashed).toBe("LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ");
      expect(hashed).toMatch(BASE64URL_NOPAD);
      expect(hashed).not.toContain("=");
    }),
  );

  it.effect("is deterministic — same input hashes to the same digest", () =>
    Effect.gen(function* () {
      const a = yield* hashKey("vh_sk_AbCdEfGhIjKlMnOpQrStUvWxYzAbCd");
      const b = yield* hashKey("vh_sk_AbCdEfGhIjKlMnOpQrStUvWxYzAbCd");
      expect(a).toBe(b);
    }),
  );

  it.effect("different inputs produce different hashes", () =>
    Effect.gen(function* () {
      const a = yield* hashKey("alpha");
      const b = yield* hashKey("beta");
      expect(a).not.toBe(b);
    }),
  );
});

describe("generateSecretKey", () => {
  it.effect("prefixes with vh_sk_ and appends 32 random body chars", () =>
    Effect.gen(function* () {
      const key = yield* generateSecretKey();
      expect(key.startsWith(PRODUCTION_SECRET_KEY_PREFIX)).toBe(true);
      expect(key.length).toBe(PRODUCTION_SECRET_KEY_PREFIX.length + 32);
      const body = key.slice(PRODUCTION_SECRET_KEY_PREFIX.length);
      expect(body).toMatch(KEY_BODY_ALPHABET);
    }),
  );

  it.effect("yields a fresh random key on each call", () =>
    Effect.gen(function* () {
      const a = yield* generateSecretKey();
      const b = yield* generateSecretKey();
      expect(a).not.toBe(b);
    }),
  );
});

describe("generatePublishableKey", () => {
  it.effect("prefixes with vh_pk_ and appends 32 random body chars", () =>
    Effect.gen(function* () {
      const key = yield* generatePublishableKey();
      expect(key.startsWith(PRODUCTION_PUBLISHABLE_KEY_PREFIX)).toBe(true);
      expect(key.length).toBe(PRODUCTION_PUBLISHABLE_KEY_PREFIX.length + 32);
      const body = key.slice(PRODUCTION_PUBLISHABLE_KEY_PREFIX.length);
      expect(body).toMatch(KEY_BODY_ALPHABET);
    }),
  );
});

describe("generateUserApiKey", () => {
  it.effect("prefixes with the supplied prefix and appends 32 body chars", () =>
    Effect.gen(function* () {
      const prefix = "myapp_";
      const key = yield* generateUserApiKey(prefix);
      expect(key.startsWith(prefix)).toBe(true);
      expect(key.length).toBe(prefix.length + 32);
      const body = key.slice(prefix.length);
      expect(body).toMatch(KEY_BODY_ALPHABET);
    }),
  );

  it.effect("treats an empty prefix as no prefix (32 body chars only)", () =>
    Effect.gen(function* () {
      const key = yield* generateUserApiKey("");
      expect(key.length).toBe(32);
      expect(key).toMatch(KEY_BODY_ALPHABET);
    }),
  );
});

describe("createSecretKey", () => {
  it.effect("returns a hashed key, plaintext rawKey, end suffix, and isPublic=false", () =>
    Effect.gen(function* () {
      const result = yield* createSecretKey();

      expect(result.isPublic).toBe(false);
      expect(result.prefix).toBe(PRODUCTION_SECRET_KEY_PREFIX);

      // rawKey is the generated plaintext: prefixed, full length.
      expect(result.rawKey.startsWith(PRODUCTION_SECRET_KEY_PREFIX)).toBe(true);
      expect(result.rawKey.length).toBe(PRODUCTION_SECRET_KEY_PREFIX.length + 32);

      // `key` is the hash of rawKey — base64url, never equal to the raw key.
      expect(result.key).not.toBe(result.rawKey);
      expect(result.key).toMatch(BASE64URL_NOPAD);
      const expectedHash = yield* hashKey(result.rawKey);
      expect(result.key).toBe(expectedHash);

      // `end` is the last KEY_END_LENGTH chars of the RAW key.
      expect(result.end.length).toBe(KEY_END_LENGTH);
      expect(result.end).toBe(result.rawKey.slice(-KEY_END_LENGTH));
    }),
  );
});

describe("createPublishableKey", () => {
  it.effect("returns the plaintext key (not hashed), end suffix, and isPublic=true", () =>
    Effect.gen(function* () {
      const result = yield* createPublishableKey();

      expect(result.isPublic).toBe(true);
      expect(result.prefix).toBe(PRODUCTION_PUBLISHABLE_KEY_PREFIX);

      // Publishable keys are not hashed: `key` mirrors `rawKey` verbatim.
      expect(result.key).toBe(result.rawKey);
      expect(result.rawKey.startsWith(PRODUCTION_PUBLISHABLE_KEY_PREFIX)).toBe(true);
      expect(result.rawKey.length).toBe(PRODUCTION_PUBLISHABLE_KEY_PREFIX.length + 32);

      expect(result.end.length).toBe(KEY_END_LENGTH);
      expect(result.end).toBe(result.rawKey.slice(-KEY_END_LENGTH));
    }),
  );
});

describe("createUserApiKey", () => {
  it.effect("returns a hashed key, plaintext rawKey, supplied prefix, and end suffix", () =>
    Effect.gen(function* () {
      const prefix = "svc_";
      const result = yield* createUserApiKey(prefix);

      expect(result.prefix).toBe(prefix);
      // No `isPublic` field on a user API key.
      expect("isPublic" in result).toBe(false);

      expect(result.rawKey.startsWith(prefix)).toBe(true);
      expect(result.rawKey.length).toBe(prefix.length + 32);

      expect(result.key).not.toBe(result.rawKey);
      expect(result.key).toMatch(BASE64URL_NOPAD);
      const expectedHash = yield* hashKey(result.rawKey);
      expect(result.key).toBe(expectedHash);

      expect(result.end.length).toBe(KEY_END_LENGTH);
      expect(result.end).toBe(result.rawKey.slice(-KEY_END_LENGTH));
    }),
  );
});
