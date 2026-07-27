import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { isEncrypted } from "../../../utils/crypto/SecretBox.ts";
import { makeStripeConfigProvider } from "./config-provider.ts";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
};
const newKeyB64 = () => bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

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
): Promise<A> =>
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return yield* body(makeStripeConfigProvider(secretCrypto));
  }).pipe(
    Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })),
    Effect.runPromise,
  );

describe("Stripe config-provider", () => {
  it("validateGlobalConfiguration encrypts Stripe secrets on write", async () => {
    const result = await run(newKeyB64(), (p) =>
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
  });

  it("stores Stripe secrets as plaintext when no encryption key is configured", async () => {
    const result = await run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
    expect(result.parsedConfiguration.live.secretKey).toBe("sk_live_123456789");
    expect(result.parsedConfiguration.live.webhookSecret).toBe("whsec_live123456789");
    expect(result.parsedConfiguration.test.secretKey).toBe("sk_test_123456789");
    expect(result.parsedConfiguration.test.webhookSecret).toBe("whsec_test123456789");
    expect(isEncrypted(result.parsedConfiguration.live.secretKey)).toBe(false);
    expect(isEncrypted(result.parsedConfiguration.test.secretKey)).toBe(false);
  });

  it("encrypt-on-write is idempotent for already-encrypted Stripe secrets", async () => {
    const key = newKeyB64();
    const once = await run(key, (p) => p.validateGlobalConfiguration(validGlobalConfig()));
    const twice = await run(key, (p) =>
      p.validateGlobalConfiguration(
        validGlobalConfig({
          live: once.parsedConfiguration.live,
          test: once.parsedConfiguration.test,
        }),
      ),
    );
    expect(twice.parsedConfiguration.live.secretKey).toBe(once.parsedConfiguration.live.secretKey);
    expect(twice.parsedConfiguration.live.webhookSecret).toBe(
      once.parsedConfiguration.live.webhookSecret,
    );
    expect(twice.parsedConfiguration.test.secretKey).toBe(once.parsedConfiguration.test.secretKey);
    expect(twice.parsedConfiguration.test.webhookSecret).toBe(
      once.parsedConfiguration.test.webhookSecret,
    );
  });

  it("accepts restricted Stripe API keys for each environment", async () => {
    const result = await run("", (p) =>
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
  });

  it("fails with a configuration validation error on invalid Stripe credentials", async () => {
    const error = await run("", (p) =>
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
  });

  it("fails when live credentials use test-mode API keys", async () => {
    const error = await run("", (p) =>
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
  });

  it("validateProductConfiguration derives the Stripe product key", async () => {
    const result = await run("", (p) =>
      p.validateProductConfiguration({
        priceId: "price_123456789",
        productId: "prod_123456789",
      }),
    );
    expect(result.productKey).toBe("prod_123456789:price_123456789");
    expect(result.parsedConfiguration.productId).toBe("prod_123456789");
    expect(result.parsedConfiguration.priceId).toBe("price_123456789");
  });

  it("defaultGlobalConfiguration returns an empty, schema-shaped blob", async () => {
    const config = await run("", (p) => p.defaultGlobalConfiguration());
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
  });
});
