import { Effect } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";
import { deriveAccountToken, uuidV5, VOIDHASH_ACCOUNT_TOKEN_NAMESPACE } from "./account-token.ts";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * VOIDHASH_ACCOUNT_TOKEN_DERIVATION v1 shared vectors — the OSS SDK asserts
 * the identical table (`@voidhash/react-native` `tests/core/uuid-v5.test.ts`).
 * If a vector here ever changes, the cross-repo contract is broken.
 */
const SHARED_VECTORS: ReadonlyArray<readonly [distinctId: string, token: string]> = [
  ["user-123", "3501e751-7582-58f9-9c1d-533c7466049f"],
  // Case-sensitive on purpose: distinctId equality is byte-exact everywhere.
  ["USER-123", "c6eb5cb5-739d-52a9-9a32-6a0fb4be71cc"],
  ["vh:anon:k2j4h5g6f7", "22c4cde2-2c40-5266-9699-35f7d271e1a8"],
  // Multibyte UTF-8 input.
  ["naïve@exämple.com", "84080bfc-8e5a-5daf-9ec4-c2221ea8d948"],
];

describe("account-token (VOIDHASH_ACCOUNT_TOKEN_DERIVATION v1)", () => {
  it.effect("reproduces the RFC 4122 UUIDv5 sanity anchor", () =>
    Effect.gen(function* () {
      expect(yield* uuidV5(DNS_NAMESPACE, "www.example.com")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    }),
  );

  it.effect("pins the namespace to its documented provenance", () =>
    Effect.gen(function* () {
      expect(yield* uuidV5(DNS_NAMESPACE, "appaccounttoken.voidhash.com")).toBe(VOIDHASH_ACCOUNT_TOKEN_NAMESPACE);
    }),
  );

  it.effect.each(SHARED_VECTORS)("derives the shared vector for %j", ([distinctId, token]) =>
    Effect.gen(function* () {
      expect(yield* deriveAccountToken(distinctId)).toBe(token);
    }),
  );

  it.effect("is deterministic and lowercase for long inputs", () =>
    Effect.gen(function* () {
      const longDistinctId = "x".repeat(1000);
      const first = yield* deriveAccountToken(longDistinctId);
      const second = yield* deriveAccountToken(longDistinctId);
      expect(first).toBe(second);
      expect(first).toBe(first.toLowerCase());
      expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }),
  );
});
