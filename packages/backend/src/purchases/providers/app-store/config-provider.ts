/**
 * App Store config-write adapter — the slice of the provider that the admin
 * configuration / product flow needs (`PaymentProviderConfigurationService`,
 * `PaymentProviderProductService`): the canonical configuration schema, key
 * derivation, default configuration blobs, and **encrypt-on-write** of the
 * secret Apple PKCS8 in-app-purchase key.
 *
 * Deliberately separate from the full record engine (`./payment-provider.ts`):
 * validating and persisting a configuration only needs the schema and
 * {@link PaymentConfigSecretCrypto}, NOT the App Store REST SDK, FX rates, or
 * the purchase-processing graph the record path pulls in. Registering this as
 * the public `AppStorePaymentProvider` tag keeps the admin config-write request
 * graph minimal (one extra dependency), while the record engine re-uses these
 * same methods — so there is a single source of truth for what a valid stored
 * configuration looks like and where the secret key is encrypted.
 *
 * This module owns the configuration schema (`globalConfiguration` /
 * `productConfiguration`); the engine imports them from here. Keeping the
 * dependency one-directional (engine → config-provider) avoids an import cycle.
 */
import * as Effect from "effect/Effect";
import * as Inspectable from "effect/Inspectable";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  AppStorePaymentProvider,
  PaymentProviderConfigurationValidationError,
  PaymentProviderProductValidationError,
  SubscriptionTransferMode,
} from "@voidhash/core-v2";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import * as P from "effect/Predicate";

/**
 * Reads a key off an as-yet-unvalidated configuration bag, rendering it the way
 * the previous `${bag.key ?? ""}` interpolation did (absent/null ⇒ empty).
 */
const configurationField = (configuration: unknown, key: string): string => {
  if (!P.isObject(configuration) || configuration === null) return "";
  if (!(key in configuration)) return "";
  const value = Reflect.get(configuration, key);
  return value === null || value === undefined ? "" : Inspectable.toStringUnknown(value, undefined);
};

const APP_APPLE_ID_PATTERN = /^[1-9]\d{0,14}$/;

export const globalConfiguration = Schema.Struct({
  appAppleId: Schema.String.check(Schema.isPattern(APP_APPLE_ID_PATTERN)),
  bundleId: Schema.String.check(Schema.isMinLength(1)),
  inAppPurchaseKeyIssuerId: Schema.String.check(Schema.isMinLength(1)),
  inAppPurchaseKeyId: Schema.String.check(Schema.isMinLength(1)),
  inAppPurchasePrivateKey: Schema.String.check(Schema.isMinLength(1)),
  appStoreConnectApiIssuerId: Schema.String.check(Schema.isMinLength(1)),
  appStoreConnectApiKeyId: Schema.String.check(Schema.isMinLength(1)),
  appStoreConnectApiVendorNumber: Schema.String.check(Schema.isMinLength(1)),
  appleServerNotificationForwardingUrl: Schema.String,
  appleSmallBusinessProgramStartDate: Schema.optional(Schema.String),
  hasAppleSmallBusinessProgramEndDate: Schema.Boolean,
  appleSmallBusinessProgramEndDate: Schema.optional(Schema.String),
  storeKitSubscriptionOfferKey: Schema.optional(Schema.String),
  storeKitTestingFrameworkCertificate: Schema.optional(Schema.String),
  shouldTrackNewPurchasesFromAppleServerNotifications: Schema.Boolean,
  /**
   * Policy applied when an App Store transaction is restored under a
   * different identified person than the one currently bound to its
   * `originalTransactionId`. Optional — configurations created before this
   * feature shipped omit it and fall back to
   * {@link DEFAULT_SUBSCRIPTION_TRANSFER_MODE}.
   */
  subscriptionTransferMode: Schema.optional(SubscriptionTransferMode),
  /**
   * Opt-in: dispatch the lazy first-seen Apple-history backfill
   * (`AppStoreReconcileOriginalTransactionWorkflow`) the first time the SDK
   * boundary records a purchase for an `originalTransactionId` we have never
   * seen. Off by default (optional, absent ⇒ disabled) because each run has
   * real Apple-REST cost; enable per-tenant for migrated/RevenueCat catalogs
   * that need history Apple holds from before the SDK boundary.
   */
  enableFirstSeenReconciliation: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.encodeKeys({
    hasAppleSmallBusinessProgramEndDate: "appleSmallBusinessProgramHasEndDate",
    shouldTrackNewPurchasesFromAppleServerNotifications:
      "trackNewPurchasesFromAppleServerNotifications",
  }),
);

export const productConfiguration = Schema.Struct({
  productId: Schema.String,
});

export type globalConfiguration = typeof globalConfiguration.Type;
export type productConfiguration = typeof productConfiguration.Type;

export type AppStoreGlobalConfiguration = Schema.Schema.Type<typeof globalConfiguration>;
export type AppStoreStoredGlobalConfiguration = Schema.Codec.Encoded<typeof globalConfiguration>;
export type AppStoreProductConfiguration = Schema.Schema.Type<typeof productConfiguration>;

const encodeGlobalConfiguration = Schema.encodeSync(globalConfiguration);

/**
 * Config-write surface of the App Store provider. Structurally a typed
 * superset of the public `PaymentProviderShape<"apple-app-store">` (the
 * `validate*` results expose the concrete configuration types so the record
 * engine can re-use them without re-parsing), and assignable to it for
 * registration under the public tag.
 */
export interface AppStoreConfigProvider {
  readonly id: "apple-app-store";
  readonly title: string;
  readonly type: "native";
  readonly defaultGlobalConfiguration: () => Effect.Effect<AppStoreStoredGlobalConfiguration>;
  readonly defaultProductConfiguration: () => Effect.Effect<AppStoreProductConfiguration>;
  readonly createGlobalKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly createProductKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly validateGlobalConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: AppStoreStoredGlobalConfiguration;
      readonly paymentProviderKey: string;
    },
    PaymentProviderConfigurationValidationError
  >;
  readonly validateProductConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: AppStoreProductConfiguration;
      readonly productKey: string;
    },
    PaymentProviderProductValidationError
  >;
}

/**
 * Build the App Store config-write provider over a resolved
 * {@link PaymentConfigSecretCrypto}. Pure with respect to the Effect context —
 * the only capability it closes over is `secretCrypto.encrypt`.
 */
export const makeAppStoreConfigProvider = (
  secretCrypto: typeof PaymentConfigSecretCrypto.Service,
): AppStoreConfigProvider => ({
  id: "apple-app-store",
  title: "App Store",
  type: "native",
  defaultGlobalConfiguration: () =>
    Effect.succeed({
      appAppleId: "",
      bundleId: "",
      inAppPurchaseKeyIssuerId: "",
      inAppPurchaseKeyId: "",
      inAppPurchasePrivateKey: "",
      appStoreConnectApiIssuerId: "",
      appStoreConnectApiKeyId: "",
      appStoreConnectApiVendorNumber: "",
      appleServerNotificationForwardingUrl: "",
      appleSmallBusinessProgramStartDate: "",
      appleSmallBusinessProgramHasEndDate: false,
      appleSmallBusinessProgramEndDate: "",
      storeKitSubscriptionOfferKey: "",
      storeKitTestingFrameworkCertificate: "",
      trackNewPurchasesFromAppleServerNotifications: true,
    }),
  defaultProductConfiguration: () =>
    Effect.succeed({
      productId: "",
    }),
  createGlobalKey: (configuration) => Effect.succeed(configurationField(configuration, "bundleId")),
  createProductKey: (configuration) =>
    Effect.succeed(configurationField(configuration, "productId")),
  validateGlobalConfiguration: (configuration) =>
    Schema.decodeUnknownEffect(globalConfiguration)(configuration).pipe(
      Effect.mapError(
        (error) => new PaymentProviderConfigurationValidationError({ cause: error.message }),
      ),
      Effect.flatMap((parsedConfiguration) =>
        // Encrypt the Apple PKCS8 key before it is persisted (idempotent — a
        // re-validated, already-encrypted value passes through unchanged). A
        // `SecretKeyError` here means the configured encryption key is broken
        // at runtime, not that the operator's configuration is invalid — fail
        // as a defect (500) rather than mislabel it a validation error.
        secretCrypto.encrypt(parsedConfiguration.inAppPurchasePrivateKey).pipe(
          Effect.map((inAppPurchasePrivateKey) => ({
            parsedConfiguration: encodeGlobalConfiguration({
              ...parsedConfiguration,
              inAppPurchasePrivateKey,
            }),
            paymentProviderKey: `${parsedConfiguration.bundleId}`,
          })),
          Effect.orDie,
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
        productKey: `${parsedConfiguration.productId}`,
      })),
    ),
});

/**
 * Live layer registering the config-write provider under the public
 * `AppStorePaymentProvider` tag. Requires only {@link PaymentConfigSecretCrypto};
 * the application root provides that (keyed from `ENCRYPTION_KEY`).
 */
export const AppStorePaymentProviderConfigLive: Layer.Layer<
  AppStorePaymentProvider,
  never,
  PaymentConfigSecretCrypto
> = Layer.effect(AppStorePaymentProvider)(
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return makeAppStoreConfigProvider(secretCrypto);
  }),
);
