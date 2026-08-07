import { Effect, Encoding, Random } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";
import { isEncrypted } from "./SecretBox.ts";
import { PaymentConfigSecretCrypto } from "./PaymentConfigSecretCrypto.ts";

/** Fresh 32-byte base64 key per test, drawn from the `Random` service. */
const newKeyB64 = Effect.gen(function* () {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = yield* Random.nextIntBetween(0, 255);
  }
  return Encoding.encodeBase64(bytes);
});

const SECRET = "-----BEGIN PRIVATE KEY-----\nMIGT...secret...==\n-----END PRIVATE KEY-----";

const run = <A, E>(
  keyB64: string,
  body: (svc: typeof PaymentConfigSecretCrypto.Service) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const svc = yield* PaymentConfigSecretCrypto;
    return yield* body(svc);
  }).pipe(Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })));

describe("PaymentConfigSecretCrypto", () => {
  it.effect("round-trips a secret when a key is configured", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const sealed = yield* run(key, (s) => s.encrypt(SECRET));
      expect(isEncrypted(sealed)).toBe(true);
      expect(sealed).not.toContain("PRIVATE KEY");
      const opened = yield* run(key, (s) => s.decrypt(sealed));
      expect(opened).toBe(SECRET);
    }),
  );

  it.effect("is a no-op when no key is configured (stores plaintext)", () =>
    Effect.gen(function* () {
      const out = yield* run("", (s) => s.encrypt(SECRET));
      expect(out).toBe(SECRET);
      expect(isEncrypted(out)).toBe(false);
    }),
  );

  it.effect("encrypt is idempotent — an already-encrypted value passes through unchanged", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const once = yield* run(key, (s) => s.encrypt(SECRET));
      const twice = yield* run(key, (s) => s.encrypt(once));
      expect(twice).toBe(once);
    }),
  );

  it.effect("decrypts plaintext (un-migrated) values unchanged regardless of key", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      expect(yield* run(key, (s) => s.decrypt(SECRET))).toBe(SECRET);
      expect(yield* run("", (s) => s.decrypt(SECRET))).toBe(SECRET);
    }),
  );

  it.effect("fails loud when a value is encrypted but no key is configured", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const sealed = yield* run(key, (s) => s.encrypt(SECRET));
      const exit = yield* Effect.exit(run("", (s) => s.decrypt(sealed)));
      expect(exit._tag).toBe("Failure");
    }),
  );
});
