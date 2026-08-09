import { Effect, Encoding, Random } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { isEncrypted } from "../../../utils/crypto/SecretBox.ts";
import { makeStripeConfigProvider } from "./config-provider.ts";

const newKeyB64 = Effect.gen(function* () {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = yield* Random.nextIntBetween(0, 255);
  }
  return Encoding.encodeBase64(bytes);
});

const validGlobalConfig = (overrides: Record<string, unknown> = {}) => ({
  accountId: "acct_123456789",
  live: {
    secretKey: "sk_live_123456789",
    webhookSecret: "whsec_live123456789",
  },
  test: {
    secretKey: "sk_test_123456789",
    webhookSecret: "whsec_test123456789",
  },
  ...overrides,
});

const run = <A, E>(
  keyB64: string,
  body: (provider: ReturnType<typeof makeStripeConfigProvider>) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return yield* body(makeStripeConfigProvider(secretCrypto));
  }).pipe(Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })));

describe("Stripe config-provider", () => {
  it.effect("validateGlobalConfiguration encrypts Stripe secrets on write", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const result = yield* run(key, (p) =>
        p.validateGlobalConfiguration(validGlobalConfig()),
      );
      expect(result.paymentProviderKey).toBe("acct_123456789");
      expect(isEncrypted(result.parsedConfiguration.live.secretKey)).toBe(true);
      expect(isEncrypted(result.parsedConfiguration.live.webhookSecret)).toBe(true);
      expect(isEncrypted(result.parsedConfiguration.test.secretKey)).toBe(true);
      expect(isEncrypted(result.parsedConfiguration.test.webhookSecret)).toBe(true);
      expect(result.parsedConfiguration.live.secretKey).not.toContain("sk_live");
      expect(result.parsedConfiguration.test.secretKey).not.toContain("sk_test");
      expect(result.parsedConfiguration.live.webhookSecret).not.toContain("whsec");
    }),
  );

  it.effect("stores Stripe secrets as plaintext when no encryption key is configured", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
      expect(result.parsedConfiguration.live.secretKey).toBe("sk_live_123456789");
      expect(result.parsedConfiguration.live.webhookSecret).toBe("whsec_live123456789");
      expect(result.parsedConfiguration.test.secretKey).toBe("sk_test_123456789");
      expect(result.parsedConfiguration.test.webhookSecret).toBe("whsec_test123456789");
      expect(isEncrypted(result.parsedConfiguration.live.secretKey)).toBe(false);
      expect(isEncrypted(result.parsedConfiguration.test.secretKey)).toBe(false);
    }),
  );

  it.effect("encrypt-on-write is idempotent for already-encrypted Stripe secrets", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const once = yield* run(key, (p) => p.validateGlobalConfiguration(validGlobalConfig()));
      const twice = yield* run(key, (p) =>
        p.validateGlobalConfiguration(
          validGlobalConfig({
            live: once.parsedConfiguration.live,
            test: once.parsedConfiguration.test,
          }),
        ),
      );
      expect(twice.parsedConfiguration.live.secretKey).toBe(
        once.parsedConfiguration.live.secretKey,
      );
      expect(twice.parsedConfiguration.live.webhookSecret).toBe(
        once.parsedConfiguration.live.webhookSecret,
      );
      expect(twice.parsedConfiguration.test.secretKey).toBe(
        once.parsedConfiguration.test.secretKey,
      );
      expect(twice.parsedConfiguration.test.webhookSecret).toBe(
        once.parsedConfiguration.test.webhookSecret,
      );
    }),
  );

  it.effect("accepts restricted Stripe API keys for each environment", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) =>
        p.validateGlobalConfiguration(
          validGlobalConfig({
            live: {
              secretKey: "rk_live_123456789",
              webhookSecret: "whsec_live123456789",
            },
            test: {
              secretKey: "rk_test_123456789",
              webhookSecret: "whsec_test123456789",
            },
          }),
        ),
      );
      expect(result.parsedConfiguration.live.secretKey).toBe("rk_live_123456789");
      expect(result.parsedConfiguration.test.secretKey).toBe("rk_test_123456789");
    }),
  );

  it.effect("fails with a configuration validation error on invalid Stripe credentials", () =>
    Effect.gen(function* () {
      const error = yield* run("", (p) =>
        Effect.flip(
          p.validateGlobalConfiguration(
            validGlobalConfig({
              test: {
                secretKey: "pk_test_public",
                webhookSecret: "not-a-webhook-secret",
              },
            }),
          ),
        ),
      );
      expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
    }),
  );

  it.effect("fails when live credentials use test-mode API keys", () =>
    Effect.gen(function* () {
      const error = yield* run("", (p) =>
        Effect.flip(
          p.validateGlobalConfiguration(
            validGlobalConfig({
              live: {
                secretKey: "sk_test_wrong_environment",
                webhookSecret: "whsec_live123456789",
              },
            }),
          ),
        ),
      );
      expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
    }),
  );

  it.effect("validateProductConfiguration derives the Stripe product key", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) =>
        p.validateProductConfiguration({
          priceId: "price_123456789",
          productId: "prod_123456789",
        }),
      );
      expect(result.productKey).toBe("prod_123456789:price_123456789");
      expect(result.parsedConfiguration.productId).toBe("prod_123456789");
      expect(result.parsedConfiguration.priceId).toBe("price_123456789");
    }),
  );

  it.effect("defaultGlobalConfiguration returns an empty, schema-shaped blob", () =>
    Effect.gen(function* () {
      const config = yield* run("", (p) => p.defaultGlobalConfiguration());
      expect(config).toEqual({
        accountId: "",
        live: {
          secretKey: "",
          webhookSecret: "",
        },
        test: {
          secretKey: "",
          webhookSecret: "",
        },
      });
    }),
  );
});
