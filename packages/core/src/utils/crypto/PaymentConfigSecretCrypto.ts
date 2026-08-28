/**
 * Service that encrypts/decrypts secret payment-provider configuration fields
 * (Apple PKCS8 key, Stripe/Google secrets) using {@link SecretBox} under a key
 * sourced from the worker environment (`ENCRYPTION_KEY`, a
 * base64 32-byte AES-256 key).
 *
 * When no key is configured (empty string) encryption is a NO-OP — values are
 * stored as plaintext. This keeps local/dev and un-provisioned environments
 * working; production sets the secret and rows become ciphertext as they are
 * written. Decryption always works on both forms (plaintext passes through;
 * ciphertext requires the key, else it fails loud).
 */
import { constant } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Option } from "effect";

import {
  decodeEncryptionKey,
  decryptSecret,
  encryptSecret,
  isEncrypted,
  SecretDecryptionError,
  type SecretKeyError,
} from "./SecretBox.ts";

export interface PaymentConfigSecretCryptoConfig {
  /** base64-encoded 32-byte key; empty string disables encryption. */
  readonly key: Effect.Effect<string>;
}

const make = (config: PaymentConfigSecretCryptoConfig) =>
  Effect.gen(function* () {
    const keyB64 = yield* config.key;
    // A malformed key is a deployment misconfiguration — fail fast (die) at
    // layer construction rather than degrade silently.
    const keyOpt = yield* Effect.gen(function* () {
      if (keyB64.length === 0) {
        // Intentional no-op mode for local/dev — but loud, so an
        // un-provisioned production environment is visible in logs instead of
        // silently persisting payment-provider secrets as plaintext.
        yield* Effect.logWarning(
          "PaymentConfigSecretCrypto: ENCRYPTION_KEY is not set — payment-provider secrets will be stored as plaintext",
        );
        return Option.none<Uint8Array>();
      }
      return Option.some(yield* decodeEncryptionKey(keyB64).pipe(Effect.orDie));
    });

    /** Encrypt a secret. Idempotent — already-encrypted values pass through. */
    const encrypt = (plaintext: string): Effect.Effect<string, SecretKeyError> => {
      if (isEncrypted(plaintext)) return Effect.succeed(plaintext);
      return Option.match(keyOpt, {
        onNone: () => Effect.succeed(plaintext),
        onSome: (key) => encryptSecret(plaintext, key),
      });
    };

    /** Decrypt a secret. Plaintext (non-prefixed) values pass through. */
    const decrypt = (
      value: string,
    ): Effect.Effect<string, SecretDecryptionError | SecretKeyError> => {
      if (!isEncrypted(value)) return Effect.succeed(value);
      return Option.match(keyOpt, {
        onNone: () =>
          Effect.fail(
            new SecretDecryptionError({
              message: "Configuration value is encrypted but ENCRYPTION_KEY is not set",
            }),
          ),
        onSome: (key) => decryptSecret(value, key),
      });
    };

    return constant({ encrypt, decrypt });
  });

export class PaymentConfigSecretCrypto extends Context.Service<PaymentConfigSecretCrypto>()(
  "core/PaymentConfigSecretCrypto",
  // Default: no key → encryption is a no-op. The application root overrides this
  // with `PaymentConfigSecretCrypto.layer({ key })` reading the worker secret.
  { make: make({ key: Effect.succeed("") }) },
) {
  static readonly layer = (
    config: PaymentConfigSecretCryptoConfig,
  ): Layer.Layer<PaymentConfigSecretCrypto> =>
    Layer.effect(PaymentConfigSecretCrypto)(make(config));
}
