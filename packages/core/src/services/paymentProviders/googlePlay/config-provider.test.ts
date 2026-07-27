import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { isEncrypted } from "../../../utils/crypto/SecretBox.ts";
import { makeGooglePlayConfigProvider } from "./config-provider.ts";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
};
const newKeyB64 = () => bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

const SERVICE_ACCOUNT_KEY = JSON.stringify({
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  client_email: "voidhash@example-project.iam.gserviceaccount.com",
  client_id: "1234567890",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIGT...secret...==\n-----END PRIVATE KEY-----\n",
  private_key_id: "private-key-id",
  project_id: "example-project",
  token_uri: "https://oauth2.googleapis.com/token",
  type: "service_account",
});

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
): Promise<A> =>
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return yield* body(makeGooglePlayConfigProvider(secretCrypto));
  }).pipe(
    Effect.provide(PaymentConfigSecretCrypto.layer({ key: Effect.succeed(keyB64) })),
    Effect.runPromise,
  );

describe("GooglePlay config-provider", () => {
  it("validateGlobalConfiguration encrypts the service account key on write", async () => {
    const result = await run(newKeyB64(), (p) =>
      p.validateGlobalConfiguration(validGlobalConfig()),
    );
    expect(result.paymentProviderKey).toBe("com.example.app");
    expect(isEncrypted(result.parsedConfiguration.serviceAccountKey)).toBe(true);
    expect(result.parsedConfiguration.serviceAccountKey).not.toContain("PRIVATE KEY");
  });

  it("stores the service account key as plaintext when no encryption key is configured", async () => {
    const result = await run("", (p) => p.validateGlobalConfiguration(validGlobalConfig()));
    expect(result.parsedConfiguration.serviceAccountKey).toBe(SERVICE_ACCOUNT_KEY);
    expect(isEncrypted(result.parsedConfiguration.serviceAccountKey)).toBe(false);
  });

  it("encrypt-on-write is idempotent for an already-encrypted service account key", async () => {
    const key = newKeyB64();
    const once = await run(key, (p) => p.validateGlobalConfiguration(validGlobalConfig()));
    const twice = await run(key, (p) =>
      p.validateGlobalConfiguration(
        validGlobalConfig({
          serviceAccountKey: once.parsedConfiguration.serviceAccountKey,
        }),
      ),
    );
    expect(twice.parsedConfiguration.serviceAccountKey).toBe(
      once.parsedConfiguration.serviceAccountKey,
    );
  });

  it("fails with a configuration validation error on an invalid service account file", async () => {
    const error = await run("", (p) =>
      Effect.flip(
        p.validateGlobalConfiguration(
          validGlobalConfig({
            serviceAccountKey: JSON.stringify({ type: "not_service_account" }),
          }),
        ),
      ),
    );
    expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
  });

  it("fails with a configuration validation error on an invalid RTDN topic name", async () => {
    const error = await run("", (p) =>
      Effect.flip(
        p.validateGlobalConfiguration(
          validGlobalConfig({
            googleRealTimeDeveloperNotificationTopicName: "invalid-topic",
          }),
        ),
      ),
    );
    expect(error._tag).toBe("PaymentProviderConfigurationValidationError");
  });

  it("validateProductConfiguration derives the product key with an optional base plan", async () => {
    const result = await run("", (p) =>
      p.validateProductConfiguration({ basePlanId: "monthly", productId: "premium" }),
    );
    expect(result.productKey).toBe("premium:monthly");
    expect(result.parsedConfiguration.productId).toBe("premium");
    expect(result.parsedConfiguration.basePlanId).toBe("monthly");
  });

  it("defaults product key to the product ID when base plan is empty", async () => {
    const result = await run("", (p) =>
      p.validateProductConfiguration({ basePlanId: "", productId: "premium" }),
    );
    expect(result.productKey).toBe("premium");
  });
});
