/**
 * Stripe config-write adapter for payment-provider configuration. It validates
 * the dashboard configuration shape, derives the provider key from the Stripe
 * account id, and encrypts API/webhook secrets before persistence.
 */
import { stringOr } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";

import {
  PaymentProviderConfigurationValidationError,
  PaymentProviderProductValidationError,
  StripePaymentProvider,
} from "@voidhash/core-v2";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { isEncrypted } from "@voidhash/core/utils/crypto/SecretBox";

/** Reads a property off an unknown configuration blob without an `as` assertion. */
const readProperty = <P extends string>(value: unknown, property: P): unknown => {
  if (P.hasProperty(value, property)) return value[property];
  return undefined;
};

const ACCOUNT_ID_PATTERN = /^acct_[A-Za-z0-9]+$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;
const STRIPE_PRODUCT_ID_PATTERN = /^prod_[A-Za-z0-9]+$/;
const STRIPE_PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/;

export const credentials = Schema.Struct({
  secretKey: Schema.String.check(Schema.isMinLength(1)),
  webhookSecret: Schema.String.check(Schema.isMinLength(1)),
});

export const globalConfiguration = Schema.Struct({
  accountId: Schema.String.check(Schema.isPattern(ACCOUNT_ID_PATTERN)),
  live: credentials,
  test: credentials,
});

export const productConfiguration = Schema.Struct({
  priceId: Schema.String.check(Schema.isPattern(STRIPE_PRICE_ID_PATTERN)),
  productId: Schema.String.check(Schema.isPattern(STRIPE_PRODUCT_ID_PATTERN)),
});

export type credentials = typeof credentials.Type;
export type globalConfiguration = typeof globalConfiguration.Type;
export type productConfiguration = typeof productConfiguration.Type;

export type StripeGlobalConfiguration = Schema.Schema.Type<typeof globalConfiguration>;
export type StripeCredentialsConfiguration = Schema.Schema.Type<typeof credentials>;
export type StripeProductConfiguration = Schema.Schema.Type<typeof productConfiguration>;

export interface StripeConfigProvider {
  readonly id: "stripe";
  readonly title: string;
  readonly type: "web-checkout";
  readonly defaultGlobalConfiguration: () => Effect.Effect<StripeGlobalConfiguration>;
  readonly defaultProductConfiguration: () => Effect.Effect<StripeProductConfiguration>;
  readonly createGlobalKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly createProductKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly validateGlobalConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: StripeGlobalConfiguration;
      readonly paymentProviderKey: string;
    },
    PaymentProviderConfigurationValidationError
  >;
  readonly validateProductConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: StripeProductConfiguration;
      readonly productKey: string;
    },
    PaymentProviderProductValidationError
  >;
}

/** Prefix-requirement message for the mode-specific Stripe API key. */
const secretKeyPrefixMessage = (mode: "live" | "test"): string => {
  if (mode === "live") return "Live Stripe API key must start with sk_live_ or rk_live_";
  return "Test Stripe API key must start with sk_test_ or rk_test_";
};

const validateSecretKey = ({
  mode,
  secretKey,
}: {
  readonly mode: "live" | "test";
  readonly secretKey: string;
}) => {
  if (isEncrypted(secretKey)) {
    return Effect.void;
  }

  return Effect.succeed(secretKey).pipe(
    Effect.filterOrFail(
      (value) => value.startsWith(`sk_${mode}_`) || value.startsWith(`rk_${mode}_`),
      () =>
        new PaymentProviderConfigurationValidationError({ cause: secretKeyPrefixMessage(mode) }),
    ),
    Effect.asVoid,
  );
};

const validateWebhookSecret = (webhookSecret: string) => {
  if (isEncrypted(webhookSecret)) {
    return Effect.void;
  }

  return Effect.succeed(webhookSecret).pipe(
    Effect.filterOrFail(
      (value) => WEBHOOK_SECRET_PATTERN.test(value),
      () =>
        new PaymentProviderConfigurationValidationError({
          cause: "Stripe webhook signing secret must start with whsec_",
        }),
    ),
    Effect.asVoid,
  );
};

const validateCredentials = (credentials: StripeCredentialsConfiguration, mode: "live" | "test") =>
  Effect.all(
    [
      validateSecretKey({ mode, secretKey: credentials.secretKey }),
      validateWebhookSecret(credentials.webhookSecret),
    ],
    { concurrency: 1, discard: true },
  );

const encryptCredentials = (
  credentials: StripeCredentialsConfiguration,
  secretCrypto: typeof PaymentConfigSecretCrypto.Service,
) =>
  Effect.all({
    secretKey: secretCrypto.encrypt(credentials.secretKey),
    webhookSecret: secretCrypto.encrypt(credentials.webhookSecret),
  }, { concurrency: 1 }).pipe(Effect.orDie);

/** Build the Stripe config-write provider over a resolved secret crypto. */
export const makeStripeConfigProvider = (
  secretCrypto: typeof PaymentConfigSecretCrypto.Service,
): StripeConfigProvider => ({
  createGlobalKey: (configuration) =>
    Effect.succeed(stringOr(readProperty(configuration, "accountId"), "")),
  createProductKey: (configuration) =>
    Effect.succeed(
      `${stringOr(readProperty(configuration, "productId"), "")}:${stringOr(readProperty(configuration, "priceId"), "")}`,
    ),
  defaultGlobalConfiguration: () =>
    Effect.succeed({
      accountId: "",
      live: {
        secretKey: "",
        webhookSecret: "",
      },
      test: {
        secretKey: "",
        webhookSecret: "",
      },
    }),
  defaultProductConfiguration: () =>
    Effect.succeed({
      priceId: "",
      productId: "",
    }),
  id: "stripe",
  title: "Stripe",
  type: "web-checkout",
  validateGlobalConfiguration: (configuration) =>
    Schema.decodeUnknownEffect(globalConfiguration)(configuration).pipe(
      Effect.mapError(
        (error) =>
          new PaymentProviderConfigurationValidationError({
            cause: error.message,
          }),
      ),
      Effect.flatMap((parsedConfiguration) =>
        Effect.all(
          [
            validateCredentials(parsedConfiguration.live, "live"),
            validateCredentials(parsedConfiguration.test, "test"),
          ],
          { concurrency: 1, discard: true },
        ).pipe(
          Effect.flatMap(() =>
            Effect.all({
              live: encryptCredentials(parsedConfiguration.live, secretCrypto),
              test: encryptCredentials(parsedConfiguration.test, secretCrypto),
            }, { concurrency: 1 }).pipe(
              Effect.map(({ live, test }) => ({
                parsedConfiguration: {
                  ...parsedConfiguration,
                  live,
                  test,
                },
                paymentProviderKey: parsedConfiguration.accountId,
              })),
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
        productKey: `${parsedConfiguration.productId}:${parsedConfiguration.priceId}`,
      })),
    ),
});

export const StripePaymentProviderConfigLive: Layer.Layer<
  StripePaymentProvider,
  never,
  PaymentConfigSecretCrypto
> = Layer.effect(StripePaymentProvider)(
  Effect.gen(function* () {
    const secretCrypto = yield* PaymentConfigSecretCrypto;
    return makeStripeConfigProvider(secretCrypto);
  }),
);
