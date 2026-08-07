import { Effect, Encoding } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";

import { base64Url, createHash } from "../../../src/services/apiKeys/create-hash.ts";

/**
 * `base64Url` and `createHash` are pure, framework-free helpers (no Effect, no
 * infra) — `base64Url.{encode,decode}` are synchronous, so those tests assert
 * synchronously. `createHash().digest` returns a plain `Promise`, so its tests
 * wrap it with `Effect.promise` inside the `it.effect` shim.
 *
 * The hash assertions use the canonical SHA-256 digest of the ASCII string
 * "test" as a fixed test vector across every output encoding:
 *   hex     = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
 *   base64  = n4bQgYhMfWWaL+qgxVrQFaO/Txsrugu/8/aB8+ +... (see below)
 */

const SHA256_TEST_HEX = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

// The 32 raw bytes of SHA-256("test"), derived from the hex vector above. Used
// to cross-check the base64/base64url encoders against the digest output.
const SHA256_TEST_BYTES = Uint8Array.from(
  SHA256_TEST_HEX.match(/../g)!.map((h) => Number.parseInt(h, 16)),
);

describe("base64Url.encode", () => {
  it("encodes a Uint8Array with the URL-safe alphabet and padding by default", () => {
    // 0xff 0xff 0xff -> all-ones bytes exercise the '-'/'_' URL-safe chars,
    // which in standard base64 would be '+'/'/'.
    const encoded = base64Url.encode(Uint8Array.from([0xff, 0xff, 0xff]));
    expect(encoded).toBe("____");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });

  it("encodes string inputs by first converting them to UTF-8 bytes", () => {
    // "Ma" -> bytes [0x4d, 0x61] -> 8 bits + 8 bits = 16, padded to 24 → "TWE=".
    expect(base64Url.encode("Ma")).toBe("TWE=");
  });

  it("encodes ArrayBuffer inputs identically to the equivalent Uint8Array", () => {
    const bytes = Uint8Array.from([0xff, 0xff, 0xff]);
    const fromBuffer = base64Url.encode(bytes.buffer);
    expect(fromBuffer).toBe(base64Url.encode(bytes));
    expect(fromBuffer).toBe("____");
  });

  it("omits padding when padding=false and keeps it on the default (true)", () => {
    const bytes = Uint8Array.from([0x01]); // one byte → 2 base64 chars + 2 '=' pads
    const padded = base64Url.encode(bytes);
    const unpadded = base64Url.encode(bytes, { padding: false });
    expect(padded).toBe("AQ==");
    expect(unpadded).toBe("AQ");
    expect(padded.endsWith("==")).toBe(true);
    expect(unpadded).not.toContain("=");
  });
});

describe("base64Url.decode", () => {
  it("round-trips an encoded URL-safe string back to the original bytes", () => {
    const original = SHA256_TEST_BYTES;
    const encoded = base64Url.encode(original);
    const decoded = base64Url.decode(encoded);
    expect([...decoded]).toEqual([...original]);
  });

  it("decodes a known URL-safe vector to its exact bytes", () => {
    // "____" (the URL-safe form of "////") decodes to three 0xff bytes.
    expect([...base64Url.decode("____")]).toEqual([0xff, 0xff, 0xff]);
  });

  it("auto-detects the standard alphabet when the input has no URL-safe chars", () => {
    // "TWFu" is plain base64 for "Man"; it contains no '-'/'_' so the decoder
    // falls back to the standard alphabet and still resolves correctly.
    const decoded = base64Url.decode("TWFu");
    expect(new TextDecoder().decode(decoded)).toBe("Man");
  });

  it("stops at padding and ignores it during decode", () => {
    expect([...base64Url.decode("AQ==")]).toEqual([0x01]);
  });

  it("throws on an invalid base64 character", () => {
    // '*' is in neither alphabet → the decoder rejects it loudly.
    expect(() => base64Url.decode("**")).toThrow(/Invalid Base64 character/);
  });
});

describe("createHash.digest", () => {
  it.effect("produces a consistent SHA-256 digest for the same input", () =>
    Effect.gen(function* () {
      const hash = createHash("SHA-256", "hex");
      const a = yield* Effect.promise(() => hash.digest("test"));
      const b = yield* Effect.promise(() => hash.digest("test"));
      expect(a).toBe(b);
      expect(a).toBe(SHA256_TEST_HEX);
    }),
  );

  it.effect("produces different digests for different inputs", () =>
    Effect.gen(function* () {
      const hash = createHash("SHA-256", "hex");
      const a = yield* Effect.promise(() => hash.digest("test"));
      const b = yield* Effect.promise(() => hash.digest("different"));
      expect(a).not.toBe(b);
    }),
  );

  it.effect("returns a raw ArrayBuffer when no encoding is specified", () =>
    Effect.gen(function* () {
      const buffer = yield* Effect.promise(() => createHash("SHA-256").digest("test"));
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      // SHA-256 is always 32 bytes regardless of input length.
      expect(buffer.byteLength).toBe(32);
      expect([...new Uint8Array(buffer)]).toEqual([...SHA256_TEST_BYTES]);
    }),
  );

  it.effect("returns a lowercase hex string when encoding='hex'", () =>
    Effect.gen(function* () {
      const hex = yield* Effect.promise(() => createHash("SHA-256", "hex").digest("test"));
      expect(hex).toBe(SHA256_TEST_HEX);
      expect(hex).toMatch(/^[0-9a-f]{64}$/);
    }),
  );

  it.effect("returns a standard base64 string when encoding='base64'", () =>
    Effect.gen(function* () {
      const b64 = yield* Effect.promise(() => createHash("SHA-256", "base64").digest("test"));
      // Must equal the standard-base64 encoding of the raw digest bytes.
      expect(b64).toBe(Encoding.encodeBase64(SHA256_TEST_BYTES));
    }),
  );

  it.effect("returns a padded URL-safe string when encoding='base64url'", () =>
    Effect.gen(function* () {
      const b64url = yield* Effect.promise(() => createHash("SHA-256", "base64url").digest("test"));
      expect(b64url).toBe(base64Url.encode(SHA256_TEST_BYTES, { padding: true }));
      expect(b64url).not.toContain("+");
      expect(b64url).not.toContain("/");
    }),
  );

  it.effect("returns an unpadded URL-safe string when encoding='base64urlnopad'", () =>
    Effect.gen(function* () {
      const nopad = yield* Effect.promise(() =>
        createHash("SHA-256", "base64urlnopad").digest("test"),
      );
      expect(nopad).toBe(base64Url.encode(SHA256_TEST_BYTES, { padding: false }));
      expect(nopad).not.toContain("=");
    }),
  );

  it.effect("hashes ArrayBuffer and TypedArray inputs the same as the equivalent string bytes", () =>
    Effect.gen(function* () {
      const hash = createHash("SHA-256", "hex");
      const expected = yield* Effect.promise(() => hash.digest("test"));
      const bytes = new TextEncoder().encode("test");
      expect(yield* Effect.promise(() => hash.digest(bytes))).toBe(expected);
      expect(yield* Effect.promise(() => hash.digest(bytes.buffer))).toBe(expected);
      // A non-byte TypedArray view is read via its underlying buffer.
      const u16 = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      expect(yield* Effect.promise(() => hash.digest(u16))).toBe(expected);
    }),
  );

  it.effect("supports other SHA families with their expected digest lengths", () =>
    Effect.gen(function* () {
      const sha1 = yield* Effect.promise(() => createHash("SHA-1").digest("test"));
      const sha512 = yield* Effect.promise(() => createHash("SHA-512").digest("test"));
      expect(sha1.byteLength).toBe(20);
      expect(sha512.byteLength).toBe(64);
    }),
  );
});
