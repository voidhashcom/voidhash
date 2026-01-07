import { Schema } from "effect";

import type { PaymentProvider } from "./types";

export const createPaymentProvider = <
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TGlobalConfigurationSchema extends Schema.Struct<any>,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TProductConfigurationSchema extends Schema.Struct<any>,
  TCreateGlobalKeyConfiguration extends object,
  TCreateProductKeyConfiguration extends object,
>(
  options: PaymentProvider<
    TGlobalConfigurationSchema,
    TProductConfigurationSchema,
    TCreateGlobalKeyConfiguration,
    TCreateProductKeyConfiguration
  >
) =>
  ({
    ...options,
    validateGlobalConfiguration: (configuration: Record<string, unknown>) =>
      Schema.decodeUnknown(options.globalConfigurationSchema)(configuration),
    validateProductConfiguration: (configuration: Record<string, unknown>) =>
      Schema.decodeUnknown(options.productConfigurationSchema)(configuration),
  });

export const appStore = createPaymentProvider({
  createGlobalKey: (configuration: { bundleId: string }) =>
    `${configuration.bundleId}`,
  createProductKey: (configuration: { productId: string }) =>
    `${configuration.productId}`,
  defaultGlobalConfiguration: {
    bundleId: "",
    issuerId: "",
    keyId: "",
    privateKey: "",
  },
  defaultProductConfiguration: {
    productId: "",
  },
  globalConfigurationSchema: Schema.Struct({
    bundleId: Schema.String.pipe(Schema.minLength(1)),
    issuerId: Schema.String.pipe(Schema.minLength(1)),
    keyId: Schema.String.pipe(Schema.minLength(1)),
    privateKey: Schema.String.pipe(Schema.minLength(1)),
  }),
  id: "apple-app-store",
  productConfigurationSchema: Schema.Struct({
    productId: Schema.String,
  }),
  title: "App Store",
  type: "native",
});

export const stripe = createPaymentProvider({
  createGlobalKey: (configuration: { secretKey: string }) =>
    `${configuration.secretKey}`,
  createProductKey: (configuration: { productId: string; priceId: string }) =>
    `${configuration.productId}-${configuration.priceId}`,
  defaultGlobalConfiguration: {
    secretKey: "",
    webhookSecret: "",
  },
  defaultProductConfiguration: {
    priceId: "",
    productId: "",
  },
  globalConfigurationSchema: Schema.Struct({
    secretKey: Schema.String.pipe(Schema.minLength(1)),
    webhookSecret: Schema.String.pipe(Schema.minLength(1)),
  }),
  id: "stripe",
  productConfigurationSchema: Schema.Struct({
    priceId: Schema.String.pipe(Schema.minLength(1)),
    productId: Schema.String.pipe(Schema.minLength(1)),
  }),
  title: "Stripe",
  type: "web-checkout",
});

export const paymentProviders = [appStore, stripe] as const;
