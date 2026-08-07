import { Effect, Schema } from "effect";

import { describe, expect, it } from "../../../src/testing/effect-vitest.ts";
import type { PaymentConfigSecretCrypto } from "../../../src/utils/crypto/PaymentConfigSecretCrypto.ts";
import { makeApplePushNotificationProvider } from "../../../src/services/notifications/ApplePushNotificationService.ts";
import { makeFirebaseCloudMessagingProvider } from "../../../src/services/notifications/FirebaseCloudMessagingService.ts";

/**
 * Pure unit coverage of the load-bearing secret behaviour of the two push
 * delivery-provider config adapters: encrypt-on-write, the secret-OMITTING read
 * DTO (no secret-bearing key ever leaves the boundary), `pushProviderKey`
 * derivation, validation, and the fail-closed `hasPlaintextSecret` gate
 * primitive. The full service-level `PUSH_REQUIRE_ENCRYPTION` gate and the
 * register/ownership flows are exercised by the integration tier (real DB).
 */

const ENC_PREFIX = "v1.aesgcm:";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/**
 * A stub of {@link PaymentConfigSecretCrypto}: `noop` mirrors an unset
 * `ENCRYPTION_KEY` (plaintext passes through); `encrypt` mirrors a configured
 * key (non-empty plaintext gets the `v1.aesgcm:` prefix, idempotently).
 */
const makeCrypto = (mode: "noop" | "encrypt"): typeof PaymentConfigSecretCrypto.Service => ({
  encrypt: (plaintext: string) => {
    if (mode === "noop" || plaintext.length === 0 || plaintext.startsWith(ENC_PREFIX)) {
      return Effect.succeed(plaintext);
    }
    return Effect.succeed(`${ENC_PREFIX}${plaintext}`);
  },
  decrypt: (value: string) => Effect.succeed(value),
});

describe("FirebaseCloudMessagingService config adapter", () => {
  const validConfig = {
    projectId: "my-fcm-project",
    serviceAccountJson: '{"client_email":"x@y.iam","private_key":"-----BEGIN-----"}',
    androidPriority: "high",
  };

  it.effect("encrypts the service-account JSON on write and derives pushProviderKey = projectId", () =>
    Effect.gen(function* () {
      const provider = makeFirebaseCloudMessagingProvider(makeCrypto("encrypt"));
      const result = yield* provider.validateGlobalConfiguration(validConfig);
      expect(result.pushProviderKey).toBe("my-fcm-project");
      expect(String(result.parsedConfiguration.serviceAccountJson).startsWith(ENC_PREFIX)).toBe(
        true,
      );
    }),
  );

  it.effect("leaves the secret plaintext when crypto is a no-op (unset key)", () =>
    Effect.gen(function* () {
      const provider = makeFirebaseCloudMessagingProvider(makeCrypto("noop"));
      const result = yield* provider.validateGlobalConfiguration(validConfig);
      expect(result.parsedConfiguration.serviceAccountJson).toBe(validConfig.serviceAccountJson);
      // hasPlaintextSecret is the fail-closed gate primitive: true iff a non-empty
      // secret is still plaintext after the encrypt pass (i.e. no key set).
      expect(provider.hasPlaintextSecret(result.parsedConfiguration)).toBe(true);
    }),
  );

  it.effect("hasPlaintextSecret is false once the secret is encrypted, and false when absent", () =>
    Effect.gen(function* () {
      const provider = makeFirebaseCloudMessagingProvider(makeCrypto("encrypt"));
      const result = yield* provider.validateGlobalConfiguration(validConfig);
      expect(provider.hasPlaintextSecret(result.parsedConfiguration)).toBe(false);
      expect(provider.hasPlaintextSecret({ projectId: "p", serviceAccountJson: "" })).toBe(false);
    }),
  );

  it.effect("read DTO omits the secret and exposes only a presence flag", () =>
    Effect.gen(function* () {
      const provider = makeFirebaseCloudMessagingProvider(makeCrypto("encrypt"));
      const result = yield* provider.validateGlobalConfiguration(validConfig);
      const dto = provider.toReadDto(result.parsedConfiguration);
      // The one deliberate deviation from the payment clone: NO secret-bearing key.
      expect(Object.keys(dto)).not.toContain("serviceAccountJson");
      expect(dto.hasServiceAccountJson).toBe(true);
      expect(dto.projectId).toBe("my-fcm-project");
      // Defence in depth: no value in the DTO leaks the ciphertext or plaintext.
      expect(encodeJson(dto)).not.toContain("private_key");
      expect(encodeJson(dto)).not.toContain(ENC_PREFIX);
    }),
  );

  it.effect("rejects a configuration missing the FCM project id", () =>
    Effect.gen(function* () {
      const provider = makeFirebaseCloudMessagingProvider(makeCrypto("encrypt"));
      const error = yield* Effect.flip(
        provider.validateGlobalConfiguration({ serviceAccountJson: "{}" }),
      );
      expect(error._tag).toBe("NotificationConfigValidationError");
    }),
  );

  it.effect(
    "deliver NEVER defects: an unparseable service account FAILS with PushInvalidCredentialsError",
    () =>
      Effect.gen(function* () {
        // Parse fails before any network call, so the failure must surface on the
        // normalized error channel (a tagged error), never as a thrown defect.
        const provider = makeFirebaseCloudMessagingProvider(makeCrypto("noop"));
        const error = yield* Effect.flip(
          provider.deliver(
            { projectId: "p", serviceAccountJson: "not-valid-json" },
            { platform: "android", platformToken: "tok" },
            { title: "t", body: "b" },
          ),
        );
        expect(error._tag).toBe("PushInvalidCredentialsError");
      }),
  );
});

describe("ApplePushNotificationService config adapter", () => {
  const validConfig = {
    teamId: "ABCDE12345",
    keyId: "KEY123456",
    privateKeyContent: "-----BEGIN PRIVATE KEY-----\nMIG...\n-----END PRIVATE KEY-----",
    bundleId: "com.example.app",
    environment: "sandbox",
  };

  it.effect("encrypts the .p8 private key on write and derives pushProviderKey = bundleId", () =>
    Effect.gen(function* () {
      const provider = makeApplePushNotificationProvider(makeCrypto("encrypt"), false);
      const result = yield* provider.validateGlobalConfiguration(validConfig);
      expect(result.pushProviderKey).toBe("com.example.app");
      expect(String(result.parsedConfiguration.privateKeyContent).startsWith(ENC_PREFIX)).toBe(true);
    }),
  );

  it.effect("read DTO omits the private key and exposes only a presence flag + metadata", () =>
    Effect.gen(function* () {
      const provider = makeApplePushNotificationProvider(makeCrypto("encrypt"), false);
      const result = yield* provider.validateGlobalConfiguration(validConfig);
      const dto = provider.toReadDto(result.parsedConfiguration);
      expect(Object.keys(dto)).not.toContain("privateKeyContent");
      expect(dto.hasPrivateKey).toBe(true);
      expect(dto.teamId).toBe("ABCDE12345");
      expect(dto.bundleId).toBe("com.example.app");
      expect(dto.environment).toBe("sandbox");
      expect(encodeJson(dto)).not.toContain("BEGIN PRIVATE KEY");
    }),
  );

  it.effect("hasPlaintextSecret tracks whether the .p8 is still plaintext", () =>
    Effect.gen(function* () {
      const noop = makeApplePushNotificationProvider(makeCrypto("noop"), false);
      const noopResult = yield* noop.validateGlobalConfiguration(validConfig);
      expect(noop.hasPlaintextSecret(noopResult.parsedConfiguration)).toBe(true);

      const enc = makeApplePushNotificationProvider(makeCrypto("encrypt"), false);
      const encResult = yield* enc.validateGlobalConfiguration(validConfig);
      expect(enc.hasPlaintextSecret(encResult.parsedConfiguration)).toBe(false);
    }),
  );

  it.effect("rejects a malformed (non-10-char) Apple Team ID", () =>
    Effect.gen(function* () {
      const provider = makeApplePushNotificationProvider(makeCrypto("encrypt"), false);
      const error = yield* Effect.flip(
        provider.validateGlobalConfiguration({ ...validConfig, teamId: "TOOSHORT" }),
      );
      expect(error._tag).toBe("NotificationConfigValidationError");
    }),
  );

  it.effect("config validation is NOT gated — APNs configs validate even though deliver is gated", () =>
    Effect.gen(function* () {
      const provider = makeApplePushNotificationProvider(makeCrypto("encrypt"), false);
      // deliver() FAILS with the routable PushNotImplementedError while gated.
      const error = yield* Effect.flip(
        provider.deliver(
          validConfig,
          { platform: "ios", platformToken: "abc" },
          { title: "t", body: "b" },
        ),
      );
      expect(error._tag).toBe("PushNotImplementedError");
    }),
  );
});
