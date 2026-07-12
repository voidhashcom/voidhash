import { describe, expect, it } from "vite-plus/test";
import { Effect, Exit } from "effect";

import {
  decodeEncryptionKey,
  decryptSecret,
  encryptSecret,
  isEncrypted,
  SecretDecryptionError,
} from "./SecretBox.ts";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
};

const newKeyB64 = () => bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

// A representative secret: a PKCS8 EC private key in PEM (multiline, base64 body).
const APPLE_PKCS8 =
  "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg\nsome+secret/key==\n-----END PRIVATE KEY-----";

describe("SecretBox (AES-256-GCM envelope encryption)", () => {
  it("round-trips a secret through encrypt → decrypt", async () => {
    const key = await Effect.runPromise(decodeEncryptionKey(newKeyB64()));
    const sealed = await Effect.runPromise(encryptSecret(APPLE_PKCS8, key));
    expect(isEncrypted(sealed)).toBe(true);
    expect(sealed).not.toContain("PRIVATE KEY"); // plaintext must not leak into the wire form
    const opened = await Effect.runPromise(decryptSecret(sealed, key));
    expect(opened).toBe(APPLE_PKCS8);
  });

  it("produces a different ciphertext each call (random IV) but decrypts equally", async () => {
    const key = await Effect.runPromise(decodeEncryptionKey(newKeyB64()));
    const a = await Effect.runPromise(encryptSecret(APPLE_PKCS8, key));
    const b = await Effect.runPromise(encryptSecret(APPLE_PKCS8, key));
    expect(a).not.toBe(b);
    expect(await Effect.runPromise(decryptSecret(a, key))).toBe(APPLE_PKCS8);
    expect(await Effect.runPromise(decryptSecret(b, key))).toBe(APPLE_PKCS8);
  });

  it("treats a non-prefixed value as plaintext (backward-compat for un-migrated rows)", async () => {
    const key = await Effect.runPromise(decodeEncryptionKey(newKeyB64()));
    const opened = await Effect.runPromise(decryptSecret(APPLE_PKCS8, key));
    expect(opened).toBe(APPLE_PKCS8);
  });

  it("fails loud on a wrong key — never returns garbage", async () => {
    const key = await Effect.runPromise(decodeEncryptionKey(newKeyB64()));
    const otherKey = await Effect.runPromise(decodeEncryptionKey(newKeyB64()));
    const sealed = await Effect.runPromise(encryptSecret(APPLE_PKCS8, key));
    const exit = await Effect.runPromiseExit(decryptSecret(sealed, otherKey));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("fails loud on a tampered ciphertext byte", async () => {
    const key = await Effect.runPromise(decodeEncryptionKey(newKeyB64()));
    const sealed = await Effect.runPromise(encryptSecret(APPLE_PKCS8, key));
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("AA") ? "BB" : "AA");
    const exit = await Effect.runPromiseExit(decryptSecret(tampered, key));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects a key of the wrong length", async () => {
    const exit = await Effect.runPromiseExit(
      decodeEncryptionKey(bytesToBase64(new Uint8Array(16))),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("decryption error is the typed SecretDecryptionError", async () => {
    const key = await Effect.runPromise(decodeEncryptionKey(newKeyB64()));
    // `Effect.flip` moves the typed error into the success channel so we can
    // assert on it directly without poking into the Cause structure.
    const error = await Effect.runPromise(
      decryptSecret("v1.aesgcm:###not-base64###", key).pipe(Effect.flip),
    );
    expect(error).toBeInstanceOf(SecretDecryptionError);
  });
});
