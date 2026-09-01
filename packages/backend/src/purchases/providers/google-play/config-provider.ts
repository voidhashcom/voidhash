/**
 * Google Play config-write adapter for the admin configuration and product
 * mapping flow. It owns the canonical Google Play configuration schema, key
 * derivation, default blobs, and encryption of the service-account JSON before
 * persistence.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { stringOr } from "@voidhash/lib/lang";

import {
  GooglePlayPaymentProvider,
  PaymentProviderConfigurationValidationError,
  PaymentProviderProductValidationError,
} from "@voidhash/core-v2";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { isEncrypted } from "@voidhash/core/utils/crypto/SecretBox";
import * as Str from "effect/String";

const PACKAGE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const RTDN_TOPIC_PATTERN = /^projects\/[^/]+\/topics\/[^/]+$/;

const ServiceAccountKey = Schema.Struct({
  client_email: Schema.String.check(Schema.isMinLength(1)),
  client_id: Schema.String.check(Schema.isMinLength(1)),
  private_key: Schema.String.check(Schema.isMinLength(1)),
  private_key_id: Schema.String.check(Schema.isMinLength(1)),
  project_id: Schema.String.check(Schema.isMinLength(1)),
  type: Schema.Literal("service_account"),
});

export const globalConfiguration = Schema.Struct({
  googleRealTimeDeveloperNotificationForwardingUrl: Schema.String,
  googleRealTimeDeveloperNotificationTopicName: Schema.String,
  packageName: Schema.String.check(Schema.isPattern(PACKAGE_NAME_PATTERN)),
  serviceAccountKey: Schema.String.check(Schema.isMinLength(1)),
});

export const productConfiguration = Schema.Struct({
  basePlanId: Schema.optional(Schema.String),
  productId: Schema.String.check(Schema.isMinLength(1)),
});

export type globalConfiguration = typeof globalConfiguration.Type;
export type productConfiguration = typeof productConfiguration.Type;

export type GooglePlayGlobalConfiguration = Schema.Schema.Type<typeof globalConfiguration>;
export type GooglePlayProductConfiguration = Schema.Schema.Type<typeof productConfiguration>;

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

  return Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(serviceAccountKey).pipe(
    Effect.mapError(
      (error) =>
        new PaymentProviderConfigurationValidationError({
          cause: `Service account key file must be valid JSON: ${error.message}`,
        }),
    ),
    Effect.flatMap((parsedJson) =>
      Schema.decodeUnknownEffect(ServiceAccountKey)(parsedJson).pipe(
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
  if (Str.isEmpty(url)) {
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
  if (Str.isEmpty(topicName)) {
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

/**
 * Google Play product key: the product id, suffixed with the base plan id when
 * the configuration carries one.
 */
const productKeyFrom = (productId: unknown, basePlanId: unknown): string => {
  const product = stringOr(productId, "");
  const basePlan = stringOr(basePlanId, "");
  if (Str.isEmpty(basePlan)) {
    return product;
  }
  return `${product}:${basePlan}`;
};

export const makeGooglePlayConfigProvider = (
  secretCrypto: typeof PaymentConfigSecretCrypto.Service,
): GooglePlayConfigProvider => ({
  createGlobalKey: (configuration) => Effect.succeed(stringOr(configuration.packageName, "")),
  createProductKey: (configuration) =>
    Effect.succeed(productKeyFrom(configuration.productId, configuration.basePlanId)),
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
    Schema.decodeUnknownEffect(globalConfiguration)(configuration).pipe(
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
          { concurrency: 1, discard: true },
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
    Schema.decodeUnknownEffect(productConfiguration)(configuration).pipe(
      Effect.mapError(
        (error) => new PaymentProviderProductValidationError({ message: error.message }),
      ),
      Effect.map((parsedConfiguration) => ({
        parsedConfiguration,
        productKey: productKeyFrom(parsedConfiguration.productId, parsedConfiguration.basePlanId),
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
