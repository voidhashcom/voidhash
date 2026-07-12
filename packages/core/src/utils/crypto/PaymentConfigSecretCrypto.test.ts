import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import { isEncrypted } from "./SecretBox.ts";
import { PaymentConfigSecretCrypto } from "./PaymentConfigSecretCrypto.ts";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
};
const newKeyB64 = () => bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

const SECRET = "-----BEGIN PRIVATE KEY-----\nMIGT...secret...==\n-----END PRIVATE KEY-----";

const run = <A, E>(
  keyB64: string,
  body: (svc: typeof PaymentConfigSecretCrypto.Service) => Effect.Effect<A, E>,
): Promise<A> =>
  Effect.gen(function* () {
    const svc = yield* PaymentConfigSecretCrypto;
    return yield* body(svc);
  }).pipe(
    Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })),
    Effect.runPromise,
  );

describe("PaymentConfigSecretCrypto", () => {
  it("round-trips a secret when a key is configured", async () => {
    const key = newKeyB64();
    const sealed = await run(key, (s) => s.encrypt(SECRET));
    expect(isEncrypted(sealed)).toBe(true);
    expect(sealed).not.toContain("PRIVATE KEY");
    const opened = await run(key, (s) => s.decrypt(sealed));
    expect(opened).toBe(SECRET);
  });

  it("is a no-op when no key is configured (stores plaintext)", async () => {
    const out = await run("", (s) => s.encrypt(SECRET));
    expect(out).toBe(SECRET);
    expect(isEncrypted(out)).toBe(false);
  });

  it("encrypt is idempotent — an already-encrypted value passes through unchanged", async () => {
    const key = newKeyB64();
    const once = await run(key, (s) => s.encrypt(SECRET));
    const twice = await run(key, (s) => s.encrypt(once));
    expect(twice).toBe(once);
  });

  it("decrypts plaintext (un-migrated) values unchanged regardless of key", async () => {
    expect(await run(newKeyB64(), (s) => s.decrypt(SECRET))).toBe(SECRET);
    expect(await run("", (s) => s.decrypt(SECRET))).toBe(SECRET);
  });

  it("fails loud when a value is encrypted but no key is configured", async () => {
    const key = newKeyB64();
    const sealed = await run(key, (s) => s.encrypt(SECRET));
    const exit = await Effect.gen(function* () {
      const svc = yield* PaymentConfigSecretCrypto;
      return yield* svc.decrypt(sealed);
    }).pipe(
      Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed("") })),
      Effect.runPromiseExit,
    );
    expect(exit._tag).toBe("Failure");
  });
});
