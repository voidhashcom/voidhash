import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { isEncrypted } from "../../../utils/crypto/SecretBox.ts";
import { makeAppStoreConfigProvider } from "./config-provider.ts";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
};
const newKeyB64 = () => bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

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
): Promise<A> =>
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return yield* body(makeAppStoreConfigProvider(secretCrypto));
  }).pipe(
    Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })),
    Effect.runPromise,
  );

describe("AppStore config-provider", () => {
  it("validateGlobalConfiguration encrypts the Apple private key on write", async () => {
    const result = await run(newKeyB64(), (p) =>
      p.validateGlobalConfiguration(validGlobalConfig()),
    );
    expect(result.paymentProviderKey).toBe("com.example.app");
    expect(isEncrypted(result.parsedConfiguration.inAppPurchasePrivateKey)).toBe(true);
    expect(result.parsedConfiguration.inAppPurchasePrivateKey).not.toContain("PRIVATE KEY");
  });

  it("stores the key as plaintext when no encryption key is configured", async () => {
    const result = await run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
    expect(result.parsedConfiguration.inAppPurchasePrivateKey).toBe(SECRET);
    expect(isEncrypted(result.parsedConfiguration.inAppPurchasePrivateKey)).toBe(false);
  });

  it("encrypt-on-write is idempotent for an already-encrypted key", async () => {
    const key = newKeyB64();
    const once = await run(key, (p) => p.validateGlobalConfiguration(validGlobalConfig()));
    const twice = await run(key, (p) =>
      p.validateGlobalConfiguration(
        validGlobalConfig({
          inAppPurchasePrivateKey: once.parsedConfiguration.inAppPurchasePrivateKey,
        }),
      ),
    );
    expect(twice.parsedConfiguration.inAppPurchasePrivateKey).toBe(
      once.parsedConfiguration.inAppPurchasePrivateKey,
    );
  });

  it("fails with a configuration validation error on an invalid global config", async () => {
    const error = await run("", (p) =>
      Effect.flip(p.validateGlobalConfiguration({ bundleId: "" })),
    );
    expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
  });

  it("validateProductConfiguration derives the product key", async () => {
    const result = await run("", (p) =>
      p.validateProductConfiguration({ productId: "premium.monthly" }),
    );
    expect(result.productKey).toBe("premium.monthly");
    expect(result.parsedConfiguration.productId).toBe("premium.monthly");
  });

  it("fails with a product validation error on an invalid product config", async () => {
    const error = await run("", (p) =>
      Effect.flip(p.validateProductConfiguration({ productId: 42 })),
    );
    expect(error._tag).toBe("PaymentProviderProductValidationError");
  });

  it("defaultGlobalConfiguration returns an empty, schema-shaped blob", async () => {
    const config = await run("", (p) => p.defaultGlobalConfiguration());
    expect(config.bundleId).toBe("");
    expect(config.inAppPurchasePrivateKey).toBe("");
    expect(config.trackNewPurchasesFromAppleServerNotifications).toBe(true);
  });

  it("accepts and round-trips the optional enableFirstSeenReconciliation flag", async () => {
    const result = await run(newKeyB64(), (p) =>
      p.validateGlobalConfiguration(validGlobalConfig({ enableFirstSeenReconciliation: true })),
    );
    expect(result.parsedConfiguration.enableFirstSeenReconciliation).toBe(true);
  });

  it("treats a configuration without enableFirstSeenReconciliation as valid (absent ⇒ off)", async () => {
    const result = await run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
    expect(result.parsedConfiguration.enableFirstSeenReconciliation).toBeUndefined();
  });
});
