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
 * This module owns the configuration schema (`globalConfigurationSchema` /
 * `productConfigurationSchema`); the engine imports them from here. Keeping the
 * dependency one-directional (engine → config-provider) avoids an import cycle.
 */
import { Effect, Layer, Schema } from "effect";

import { PaymentProviderConfigurationValidationError } from "../../../domain/paymentProvider/PaymentProviderConfiguration.ts";
import { PaymentProviderProductValidationError } from "../../../domain/paymentProvider/PaymentProviderProduct.ts";
import { SubscriptionTransferModeSchema } from "../../../domain/paymentProvider/SubscriptionTransfer.ts";
import { PaymentConfigSecretCrypto } from "../../../utils/crypto/PaymentConfigSecretCrypto.ts";
import { AppStorePaymentProvider } from "../PaymentProvider.ts";

/**
 * Reads a key off an as-yet-unvalidated configuration bag, rendering it the way
 * the previous `${bag.key ?? ""}` interpolation did (absent/null ⇒ empty).
 */
const configurationField = (configuration: unknown, key: string): string => {
  if (typeof configuration !== "object" || configuration === null) return "";
  if (!(key in configuration)) return "";
  return String(Reflect.get(configuration, key) ?? "");
};

const APP_APPLE_ID_PATTERN = /^[1-9]\d{0,14}$/;

export const globalConfigurationSchema = Schema.Struct({
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
  appleSmallBusinessProgramHasEndDate: Schema.Boolean,
  appleSmallBusinessProgramEndDate: Schema.optional(Schema.String),
  storeKitSubscriptionOfferKey: Schema.optional(Schema.String),
  storeKitTestingFrameworkCertificate: Schema.optional(Schema.String),
  trackNewPurchasesFromAppleServerNotifications: Schema.Boolean,
  /**
   * Policy applied when an App Store transaction is restored under a
   * different identified person than the one currently bound to its
   * `originalTransactionId`. Optional — configurations created before this
   * feature shipped omit it and fall back to
   * {@link DEFAULT_SUBSCRIPTION_TRANSFER_MODE}.
   */
  subscriptionTransferMode: Schema.optional(SubscriptionTransferModeSchema),
  /**
   * Opt-in: dispatch the lazy first-seen Apple-history backfill
   * (`AppStoreReconcileOriginalTransactionWorkflow`) the first time the SDK
   * boundary records a purchase for an `originalTransactionId` we have never
   * seen. Off by default (optional, absent ⇒ disabled) because each run has
   * real Apple-REST cost; enable per-tenant for migrated/RevenueCat catalogs
   * that need history Apple holds from before the SDK boundary.
   */
  enableFirstSeenReconciliation: Schema.optional(Schema.Boolean),
});

export const productConfigurationSchema = Schema.Struct({
  productId: Schema.String,
});

export type AppStoreGlobalConfiguration = Schema.Schema.Type<typeof globalConfigurationSchema>;
export type AppStoreProductConfiguration = Schema.Schema.Type<typeof productConfigurationSchema>;

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
  readonly defaultGlobalConfiguration: () => Effect.Effect<AppStoreGlobalConfiguration>;
  readonly defaultProductConfiguration: () => Effect.Effect<AppStoreProductConfiguration>;
  readonly createGlobalKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly createProductKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly validateGlobalConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: AppStoreGlobalConfiguration;
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
    Schema.decodeUnknownEffect(globalConfigurationSchema)(configuration).pipe(
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
            parsedConfiguration: { ...parsedConfiguration, inAppPurchasePrivateKey },
            paymentProviderKey: `${parsedConfiguration.bundleId}`,
          })),
          Effect.orDie,
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
