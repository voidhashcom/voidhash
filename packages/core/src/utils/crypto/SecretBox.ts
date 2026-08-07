/**
 * Envelope encryption for secret payment-provider configuration fields
 * (Apple PKCS8 in-app-purchase keys, Stripe secret keys, Google service-account
 * keys). Uses AES-256-GCM via WebCrypto only — no Node `crypto`/`Buffer` — so it
 * runs unchanged on Cloudflare Workers.
 *
 * Wire format (versioned so the scheme can evolve and so plaintext can be
 * detected during migration):
 *
 *   "v1.aesgcm:" + base64( iv[12] ‖ ciphertext‖gcmTag )
 *
 * {@link decryptSecret} treats any value WITHOUT the `v1.aesgcm:` prefix as
 * already-plaintext and returns it unchanged. This lets the encryption seam be
 * deployed over a table that still holds plaintext rows: reads keep working,
 * and rows become ciphertext as they are next written (or by a backfill).
 */
import { Effect, Encoding, Schema } from "effect";

const VERSION_PREFIX = "v1.aesgcm:";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/** Raised when a value cannot be decrypted (wrong key, tampered, malformed). */
export class SecretDecryptionError extends Schema.TaggedErrorClass<SecretDecryptionError>(
  "SecretDecryptionError",
)("SecretDecryptionError", { message: Schema.String }) {}

/** Raised when the configured encryption key is not a valid 32-byte base64 key. */
export class SecretKeyError extends Schema.TaggedErrorClass<SecretKeyError>("SecretKeyError")(
  "SecretKeyError",
  { message: Schema.String },
) {}

/**
 * Copies `bytes` into a view backed by a plain `ArrayBuffer`, the shape
 * WebCrypto's `BufferSource` parameters require.
 */
const bufferSource = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
};

const importKey = (rawKey: Uint8Array, usage: "encrypt" | "decrypt") =>
  Effect.tryPromise({
    try: () =>
      crypto.subtle.importKey("raw", bufferSource(rawKey), { name: "AES-GCM" }, false, [usage]),
    catch: (cause) =>
      new SecretKeyError({ message: `Failed to import AES-GCM key: ${String(cause)}` }),
  });

/** Decode a base64-encoded 32-byte AES-256 key, validating its length. */
export const decodeEncryptionKey = (base64Key: string): Effect.Effect<Uint8Array, SecretKeyError> =>
  Effect.fromResult(Encoding.decodeBase64(base64Key)).pipe(
    Effect.mapError(
      (cause) =>
        new SecretKeyError({ message: `Encryption key is not valid base64: ${cause.message}` }),
    ),
    Effect.filterOrFail(
      (bytes) => bytes.length === KEY_BYTES,
      (bytes) =>
        new SecretKeyError({
          message: `Encryption key must be ${KEY_BYTES} bytes (got ${bytes.length})`,
        }),
    ),
  );

/** Returns true if `value` is in the encrypted wire format. */
export const isEncrypted = (value: string): boolean => value.startsWith(VERSION_PREFIX);

/**
 * Encrypt a UTF-8 secret string with AES-256-GCM. The 96-bit IV is random per
 * call and prepended to the ciphertext.
 */
export const encryptSecret = (
  plaintext: string,
  rawKey: Uint8Array,
): Effect.Effect<string, SecretKeyError> =>
  Effect.gen(function* () {
    const key = yield* importKey(rawKey, "encrypt");
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
      catch: (cause) =>
        new SecretKeyError({ message: `AES-GCM encryption failed: ${String(cause)}` }),
    });
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return VERSION_PREFIX + Encoding.encodeBase64(combined);
  });

/**
 * Decrypt a value produced by {@link encryptSecret}. Values without the
 * `v1.aesgcm:` prefix are assumed to be plaintext (pre-encryption rows) and
 * returned unchanged.
 */
export const decryptSecret = (
  value: string,
  rawKey: Uint8Array,
): Effect.Effect<string, SecretDecryptionError | SecretKeyError> =>
  Effect.gen(function* () {
    if (!isEncrypted(value)) {
      return value;
    }
    const combined = yield* Effect.fromResult(
      Encoding.decodeBase64(value.slice(VERSION_PREFIX.length)),
    ).pipe(
      Effect.mapError(
        (cause) => new SecretDecryptionError({ message: `Malformed ciphertext: ${cause.message}` }),
      ),
    );
    if (combined.length <= IV_BYTES) {
      return yield* Effect.fail(new SecretDecryptionError({ message: "Ciphertext too short" }));
    }
    const iv = combined.slice(0, IV_BYTES);
    const ciphertext = combined.slice(IV_BYTES);
    const key = yield* importKey(rawKey, "decrypt");
    const plaintext = yield* Effect.tryPromise({
      try: () => crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, bufferSource(ciphertext)),
      catch: (cause) =>
        new SecretDecryptionError({
          message: `AES-GCM decryption failed (wrong key or tampered value): ${String(cause)}`,
        }),
    });
    return new TextDecoder().decode(plaintext);
  });
