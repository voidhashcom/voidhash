import { Effect, Encoding, Exit, Random } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";
import {
  decodeEncryptionKey,
  decryptSecret,
  encryptSecret,
  isEncrypted,
  SecretDecryptionError,
} from "./SecretBox.ts";

const newKeyB64 = Effect.gen(function* () {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = yield* Random.nextIntBetween(0, 255);
  }
  return Encoding.encodeBase64(bytes);
});

const newKey = Effect.flatMap(newKeyB64, decodeEncryptionKey);

/** Flips the final base64 pair so the ciphertext no longer authenticates. */
const flipTail = (sealed: string): string => {
  if (sealed.endsWith("AA")) {
    return `${sealed.slice(0, -2)}BB`;
  }
  return `${sealed.slice(0, -2)}AA`;
};

// A representative secret: a PKCS8 EC private key in PEM (multiline, base64 body).
const APPLE_PKCS8 =
  "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\nsome+secret/key==\n-----END PRIVATE KEY-----";

describe("SecretBox (AES-256-GCM envelope encryption)", () => {
  it.effect("round-trips a secret through encrypt → decrypt", () =>
    Effect.gen(function* () {
      const key = yield* newKey;
      const sealed = yield* encryptSecret(APPLE_PKCS8, key);
      expect(isEncrypted(sealed)).toBe(true);
      expect(sealed).not.toContain("PRIVATE KEY"); // plaintext must not leak into the wire form
      const opened = yield* decryptSecret(sealed, key);
      expect(opened).toBe(APPLE_PKCS8);
    }),
  );

  it.effect("produces a different ciphertext each call (random IV) but decrypts equally", () =>
    Effect.gen(function* () {
      const key = yield* newKey;
      const a = yield* encryptSecret(APPLE_PKCS8, key);
      const b = yield* encryptSecret(APPLE_PKCS8, key);
      expect(a).not.toBe(b);
      expect(yield* decryptSecret(a, key)).toBe(APPLE_PKCS8);
      expect(yield* decryptSecret(b, key)).toBe(APPLE_PKCS8);
    }),
  );

  it.effect("treats a non-prefixed value as plaintext (backward-compat for un-migrated rows)", () =>
    Effect.gen(function* () {
      const key = yield* newKey;
      const opened = yield* decryptSecret(APPLE_PKCS8, key);
      expect(opened).toBe(APPLE_PKCS8);
    }),
  );

  it.effect("fails loud on a wrong key — never returns garbage", () =>
    Effect.gen(function* () {
      const key = yield* newKey;
      const otherKey = yield* newKey;
      const sealed = yield* encryptSecret(APPLE_PKCS8, key);
      const exit = yield* Effect.exit(decryptSecret(sealed, otherKey));
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );

  it.effect("fails loud on a tampered ciphertext byte", () =>
    Effect.gen(function* () {
      const key = yield* newKey;
      const sealed = yield* encryptSecret(APPLE_PKCS8, key);
      const exit = yield* Effect.exit(decryptSecret(flipTail(sealed), key));
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );

  it.effect("rejects a key of the wrong length", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeEncryptionKey(Encoding.encodeBase64(new Uint8Array(16))),
      );
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );

  it.effect("decryption error is the typed SecretDecryptionError", () =>
    Effect.gen(function* () {
      const key = yield* newKey;
      // `Effect.flip` moves the typed error into the success channel so we can
      // assert on it directly without poking into the Cause structure.
      const error = yield* Effect.flip(decryptSecret("v1.aesgcm:###not-base64###", key));
      expect(error).toBeInstanceOf(SecretDecryptionError);
    }),
  );
});
