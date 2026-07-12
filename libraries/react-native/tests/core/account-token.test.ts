import { describe, expect, it } from "vitest";

import {
  deriveAccountToken,
  uuidV5,
  VOIDHASH_ACCOUNT_TOKEN_NAMESPACE,
} from "../../src/core/utils/account-token";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const vectors = [
  ["user-123", "3501e751-7582-58f9-9c1d-533c7466049f"],
  ["USER-123", "c6eb5cb5-739d-52a9-9a32-6a0fb4be71cc"],
  ["vh:anon:k2j4h5g6f7", "22c4cde2-2c40-5266-9699-35f7d271e1a8"],
  ["naïve@exämple.com", "84080bfc-8e5a-5daf-9ec4-c2221ea8d948"],
] as const;

describe("account token derivation", () => {
  it("reproduces the RFC 4122 UUIDv5 sanity anchor", () => {
    expect(uuidV5(DNS_NAMESPACE, "www.example.com")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("pins the shared namespace", () => {
    expect(uuidV5(DNS_NAMESPACE, "appaccounttoken.voidhash.com")).toBe(
      VOIDHASH_ACCOUNT_TOKEN_NAMESPACE,
    );
  });

  for (const [distinctId, expected] of vectors) {
    it(`matches the backend vector for ${JSON.stringify(distinctId)}`, () => {
      expect(deriveAccountToken(distinctId)).toBe(expected);
    });
  }

  it("is deterministic and lowercase for long inputs", () => {
    const distinctId = "person:".repeat(200);
    const first = deriveAccountToken(distinctId);

    expect(deriveAccountToken(distinctId)).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
