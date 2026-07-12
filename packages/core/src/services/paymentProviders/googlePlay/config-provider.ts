/**
 * Google Play config-write adapter for the admin configuration and product
 * mapping flow. It owns the canonical Google Play configuration schema, key
 * derivation, default blobs, and encryption of the service-account JSON before
 * persistence.
 */
import { Effect, Layer, Schema } from "effect";

import { PaymentProviderConfigurationValidationError } from "../../../domain/paymentProvider/PaymentProviderConfiguration.ts";
import { PaymentProviderProductValidationError } from "../../../domain/paymentProvider/PaymentProviderProduct.ts";
import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { isEncrypted } from "../../../utils/crypto/SecretBox.ts";
import { GooglePlayPaymentProvider } from "../PaymentProvider.ts";

const PACKAGE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const RTDN_TOPIC_PATTERN = /^projects\/[^/]+\/topics\/[^/]+$/;

const serviceAccountKeySchema = Schema.Struct({
  client_email: Schema.String.check(Schema.isMinLength(1)),
  client_id: Schema.String.check(Schema.isMinLength(1)),
  private_key: Schema.String.check(Schema.isMinLength(1)),
  private_key_id: Schema.String.check(Schema.isMinLength(1)),
  project_id: Schema.String.check(Schema.isMinLength(1)),
  type: Schema.Literal("service_account"),
});

export const globalConfigurationSchema = Schema.Struct({
  googleRealTimeDeveloperNotificationForwardingUrl: Schema.String,
  googleRealTimeDeveloperNotificationTopicName: Schema.String,
  packageName: Schema.String.check(Schema.isPattern(PACKAGE_NAME_PATTERN)),
  serviceAccountKey: Schema.String.check(Schema.isMinLength(1)),
});

export const productConfigurationSchema = Schema.Struct({
  basePlanId: Schema.optional(Schema.String),
  productId: Schema.String.check(Schema.isMinLength(1)),
});

export type GooglePlayGlobalConfiguration = Schema.Schema.Type<typeof globalConfigurationSchema>;
export type GooglePlayProductConfiguration = Schema.Schema.Type<typeof productConfigurationSchema>;

export interface GooglePlayConfigProvider {
  readonly id: "google-play";
  readonly title: string;
  readonly type: "native";
  readonly defaultGlobalConfiguration: () => Effect.Effect<GooglePlayGlobalConfiguration>;
  readonly defaultProductConfiguration: () => Effect.Effect<GooglePlayProductConfiguration>;
  readonly createGlobalKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly createProductKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly validateGlobalConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: GooglePlayGlobalConfiguration;
      readonly paymentProviderKey: string;
    },
    PaymentProviderConfigurationValidationError
  >;
  readonly validateProductConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: GooglePlayProductConfiguration;
      readonly productKey: string;
    },
    PaymentProviderProductValidationError
  >;
}

const validatePlainServiceAccountKey = (serviceAccountKey: string) => {
  if (isEncrypted(serviceAccountKey)) {
    return Effect.void;
  }

  return Effect.try({
    try: () => JSON.parse(serviceAccountKey) as unknown,
    catch: (cause) =>
      new PaymentProviderConfigurationValidationError({
        cause: `Service account key file must be valid JSON: ${String(cause)}`,
      }),
  }).pipe(
    Effect.flatMap((parsedJson) =>
      Schema.decodeUnknownEffect(serviceAccountKeySchema)(parsedJson).pipe(
        Effect.mapError(
          (error) =>
            new PaymentProviderConfigurationValidationError({
              cause: `Service account key file is not a Google service account JSON: ${error.message}`,
            }),
        ),
      ),
    ),
    Effect.asVoid,
  );
};

const validateOptionalUrl = (url: string) => {
  if (url.length === 0) {
    return Effect.void;
  }

  return Effect.try({
    try: () => new URL(url),
    catch: () =>
      new PaymentProviderConfigurationValidationError({
        cause: "Raw Google events forwarding URL must be a valid URL",
      }),
  }).pipe(
    Effect.filterOrFail(
      (parsedUrl) => parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:",
      () =>
        new PaymentProviderConfigurationValidationError({
          cause: "Raw Google events forwarding URL must use http or https",
        }),
    ),
    Effect.asVoid,
  );
};

const validateOptionalRtdnTopicName = (topicName: string) => {
  if (topicName.length === 0) {
    return Effect.void;
  }

  return Effect.succeed(topicName).pipe(
    Effect.filterOrFail(
      (value) => RTDN_TOPIC_PATTERN.test(value),
      () =>
        new PaymentProviderConfigurationValidationError({
          cause: "Google Play RTDN topic name must use projects/{project}/topics/{topic}",
        }),
    ),
    Effect.asVoid,
  );
};

export const makeGooglePlayConfigProvider = (
  secretCrypto: typeof PaymentConfigSecretCrypto.Service,
): GooglePlayConfigProvider => ({
  createGlobalKey: (configuration) =>
    Effect.succeed(`${(configuration as { packageName?: unknown }).packageName ?? ""}`),
  createProductKey: (configuration) =>
    Effect.succeed(
      `${(configuration as { productId?: unknown }).productId ?? ""}${
        (configuration as { basePlanId?: unknown }).basePlanId
          ? `:${(configuration as { basePlanId?: unknown }).basePlanId}`
          : ""
      }`,
    ),
  defaultGlobalConfiguration: () =>
    Effect.succeed({
      googleRealTimeDeveloperNotificationForwardingUrl: "",
      googleRealTimeDeveloperNotificationTopicName: "",
      packageName: "",
      serviceAccountKey: "",
    }),
  defaultProductConfiguration: () =>
    Effect.succeed({
      basePlanId: "",
      productId: "",
    }),
  id: "google-play",
  title: "Google Play",
  type: "native",
  validateGlobalConfiguration: (configuration) =>
    Schema.decodeUnknownEffect(globalConfigurationSchema)(configuration).pipe(
      Effect.mapError(
        (error) => new PaymentProviderConfigurationValidationError({ cause: error.message }),
      ),
      Effect.flatMap((parsedConfiguration) =>
        Effect.all(
          [
            validatePlainServiceAccountKey(parsedConfiguration.serviceAccountKey),
            validateOptionalUrl(
              parsedConfiguration.googleRealTimeDeveloperNotificationForwardingUrl,
            ),
            validateOptionalRtdnTopicName(
              parsedConfiguration.googleRealTimeDeveloperNotificationTopicName,
            ),
          ],
          { discard: true },
        ).pipe(
          Effect.flatMap(() =>
            secretCrypto.encrypt(parsedConfiguration.serviceAccountKey).pipe(
              Effect.map((serviceAccountKey) => ({
                parsedConfiguration: { ...parsedConfiguration, serviceAccountKey },
                paymentProviderKey: `${parsedConfiguration.packageName}`,
              })),
              Effect.orDie,
            ),
          ),
        ),
      ),
    ),
  validateProductConfiguration: (configuration) =>
    Schema.decodeUnknownEffect(productConfigurationSchema)(configuration).pipe(
      Effect.mapError(
        (error) => new PaymentProviderProductValidationError({ message: error.message }),
      ),
      Effect.map((parsedConfiguration) => ({
        parsedConfiguration,
        productKey: parsedConfiguration.basePlanId
          ? `${parsedConfiguration.productId}:${parsedConfiguration.basePlanId}`
          : `${parsedConfiguration.productId}`,
      })),
    ),
});

export const GooglePlayPaymentProviderConfigLive: Layer.Layer<
  GooglePlayPaymentProvider,
  never,
  PaymentConfigSecretCrypto
> = Layer.effect(GooglePlayPaymentProvider)(
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return makeGooglePlayConfigProvider(secretCrypto);
  }),
);
