import { Effect, Encoding, Random } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { isEncrypted } from "../../../utils/crypto/SecretBox.ts";
import { makeGooglePlayConfigProvider } from "./config-provider.ts";

const newKeyB64 = Effect.gen(function* () {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = yield* Random.nextIntBetween(0, 255);
  }
  return Encoding.encodeBase64(bytes);
});

// Written as raw JSON text (not built with JSON.stringify) so the fixture is exactly
// the wire form the provider receives.
const SERVICE_ACCOUNT_KEY =
  '{"auth_uri":"https://accounts.google.com/o/oauth2/auth",' +
  '"client_email":"voidhash@example-project.iam.gserviceaccount.com",' +
  '"client_id":"1234567890",' +
  '"private_key":"-----BEGIN PRIVATE KEY-----\\nMIGT...secret...==\\n-----END PRIVATE KEY-----\\n",' +
  '"private_key_id":"private-key-id",' +
  '"project_id":"example-project",' +
  '"token_uri":"https://oauth2.googleapis.com/token",' +
  '"type":"service_account"}';

const INVALID_SERVICE_ACCOUNT_KEY = '{"type":"not_service_account"}';

const validGlobalConfig = (overrides: Record<string, unknown> = {}) => ({
  googleRealTimeDeveloperNotificationForwardingUrl: "",
  googleRealTimeDeveloperNotificationTopicName: "",
  packageName: "com.example.app",
  serviceAccountKey: SERVICE_ACCOUNT_KEY,
  ...overrides,
});

const run = <A, E>(
  keyB64: string,
  body: (provider: ReturnType<typeof makeGooglePlayConfigProvider>) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return yield* body(makeGooglePlayConfigProvider(secretCrypto));
  }).pipe(Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })));

describe("GooglePlay config-provider", () => {
  it.effect("validateGlobalConfiguration encrypts the service account key on write", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const result = yield* run(key, (p) =>
        p.validateGlobalConfiguration(validGlobalConfig()),
      );
      expect(result.paymentProviderKey).toBe("com.example.app");
      expect(isEncrypted(result.parsedConfiguration.serviceAccountKey)).toBe(true);
      expect(result.parsedConfiguration.serviceAccountKey).not.toContain("PRIVATE KEY");
    }),
  );

  it.effect(
    "stores the service account key as plaintext when no encryption key is configured",
    () =>
      Effect.gen(function* () {
        const result = yield* run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
        expect(result.parsedConfiguration.serviceAccountKey).toBe(SERVICE_ACCOUNT_KEY);
        expect(isEncrypted(result.parsedConfiguration.serviceAccountKey)).toBe(false);
      }),
  );

  it.effect("encrypt-on-write is idempotent for an already-encrypted service account key", () =>
    Effect.gen(function* () {
      const key = yield* newKeyB64;
      const once = yield* run(key, (p) => p.validateGlobalConfiguration(validGlobalConfig()));
      const twice = yield* run(key, (p) =>
        p.validateGlobalConfiguration(
          validGlobalConfig({
            serviceAccountKey: once.parsedConfiguration.serviceAccountKey,
          }),
        ),
      );
      expect(twice.parsedConfiguration.serviceAccountKey).toBe(
        once.parsedConfiguration.serviceAccountKey,
      );
    }),
  );

  it.effect(
    "fails with a configuration validation error on an invalid service account file",
    () =>
      Effect.gen(function* () {
        const error = yield* run("", (p) =>
          Effect.flip(
            p.validateGlobalConfiguration(
              validGlobalConfig({
                serviceAccountKey: INVALID_SERVICE_ACCOUNT_KEY,
              }),
            ),
          ),
        );
        expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
      }),
  );

  it.effect("fails with a configuration validation error on an invalid RTDN topic name", () =>
    Effect.gen(function* () {
      const error = yield* run("", (p) =>
        Effect.flip(
          p.validateGlobalConfiguration(
            validGlobalConfig({
              googleRealTimeDeveloperNotificationTopicName: "invalid-topic",
            }),
          ),
        ),
      );
      expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
    }),
  );

  it.effect("validateProductConfiguration derives the product key with an optional base plan", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) =>
        p.validateProductConfiguration({ basePlanId: "monthly", productId: "premium" }),
      );
      expect(result.productKey).toBe("premium:monthly");
      expect(result.parsedConfiguration.productId).toBe("premium");
      expect(result.parsedConfiguration.basePlanId).toBe("monthly");
    }),
  );

  it.effect("defaults product key to the product ID when base plan is empty", () =>
    Effect.gen(function* () {
      const result = yield* run("", (p) =>
        p.validateProductConfiguration({ basePlanId: "", productId: "premium" }),
      );
      expect(result.productKey).toBe("premium");
    }),
  );
});
