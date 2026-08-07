import { Effect, Encoding, Random } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { isEncrypted } from "../../../utils/crypto/SecretBox.ts";
import { makeAppStoreConfigProvider } from "./config-provider.ts";

/** Fresh 32-byte base64 key per test, drawn from the `Random` service. */
const newKeyB64 = Effect.gen(function* () {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = yield* Random.nextIntBetween(0, 255);
  }
  return Encoding.encodeBase64(bytes);
});

const SECRET = "-----BEGIN PRIVATE KEY-----\nMIGT...secret...==\n-----END PRIVATE KEY-----";

/** A configuration that passes `globalConfigurationSchema`. */
const validGlobalConfig = (overrides: Record<string, unknown> = {}) => ({
  appAppleId: "123456789",
  bundleId: "com.example.app",
  inAppPurchaseKeyIssuerId: "issuer-id",
  inAppPurchaseKeyId: "key-id",
  inAppPurchasePrivateKey: SECRET,
  appStoreConnectApiIssuerId: "asc-issuer",
  appStoreConnectApiKeyId: "asc-key",
  appStoreConnectApiVendorNumber: "vendor-1",
  appleServerNotificationForwardingUrl: "",
  appleSmallBusinessProgramHasEndDate: false,
  trackNewPurchasesFromAppleServerNotifications: true,
  ...overrides,
});

const run = <A, E>(
  keyB64: string,
  body: (provider: ReturnType<typeof makeAppStoreConfigProvider>) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return yield* body(makeAppStoreConfigProvider(secretCrypto));
  }).pipe(Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })));

describe("AppStore config-provider", () => {
  it.effect("validateGlobalConfiguration encrypts the Apple private key on write", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const result = yield* run(key, (p) => p.validateGlobalConfiguration(validGlobalConfig()));
      expect(result.paymentProviderKey).toBe("com.example.app");
      expect(isEncrypted(result.parsedConfiguration.inAppPurchasePrivateKey)).toBe(true);
      expect(result.parsedConfiguration.inAppPurchasePrivateKey).not.toContain("PRIVATE KEY");
    }),
  );

  it.effect("stores the key as plaintext when no encryption key is configured", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
      expect(result.parsedConfiguration.inAppPurchasePrivateKey).toBe(SECRET);
      expect(isEncrypted(result.parsedConfiguration.inAppPurchasePrivateKey)).toBe(false);
    }),
  );

  it.effect("encrypt-on-write is idempotent for an already-encrypted key", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const once = yield* run(key, (p) => p.validateGlobalConfiguration(validGlobalConfig()));
      const twice = yield* run(key, (p) =>
        p.validateGlobalConfiguration(
          validGlobalConfig({
            inAppPurchasePrivateKey: once.parsedConfiguration.inAppPurchasePrivateKey,
          }),
        ),
      );
      expect(twice.parsedConfiguration.inAppPurchasePrivateKey).toBe(
        once.parsedConfiguration.inAppPurchasePrivateKey,
      );
    }),
  );

  it.effect("fails with a configuration validation error on an invalid global config", () =>
    Effect.gen(function* () {
      const error = yield* run("", (p) =>
        Effect.flip(p.validateGlobalConfiguration({ bundleId: "" })),
      );
      expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
    }),
  );

  it.effect("validateProductConfiguration derives the product key", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) =>
        p.validateProductConfiguration({ productId: "premium.monthly" }),
      );
      expect(result.productKey).toBe("premium.monthly");
      expect(result.parsedConfiguration.productId).toBe("premium.monthly");
    }),
  );

  it.effect("fails with a product validation error on an invalid product config", () =>
    Effect.gen(function* () {
      const error = yield* run("", (p) =>
        Effect.flip(p.validateProductConfiguration({ productId: 42 })),
      );
      expect(error._tag).toBe("PaymentProviderProductValidationError");
    }),
  );

  it.effect("defaultGlobalConfiguration returns an empty, schema-shaped blob", () =>
    Effect.gen(function* () {
      const config = yield* run("", (p) => p.defaultGlobalConfiguration());
      expect(config.bundleId).toBe("");
      expect(config.inAppPurchasePrivateKey).toBe("");
      expect(config.trackNewPurchasesFromAppleServerNotifications).toBe(true);
    }),
  );

  it.effect("accepts and round-trips the optional enableFirstSeenReconciliation flag", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const result = yield* run(key, (p) =>
        p.validateGlobalConfiguration(validGlobalConfig({ enableFirstSeenReconciliation: true })),
      );
      expect(result.parsedConfiguration.enableFirstSeenReconciliation).toBe(true);
    }),
  );

  it.effect("treats a configuration without enableFirstSeenReconciliation as valid (absent ⇒ off)", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
      expect(result.parsedConfiguration.enableFirstSeenReconciliation).toBeUndefined();
    }),
  );
});
