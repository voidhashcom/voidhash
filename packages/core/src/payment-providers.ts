import { Schema } from 'effect';
import type { PaymentProvider } from './types';

export const createPaymentProvider = <
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TGlobalConfigurationSchema extends Schema.Struct<any>,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TProductConfigurationSchema extends Schema.Struct<any>,
  TCreateGlobalKeyConfiguration extends object,
  TCreateProductKeyConfiguration extends object
>(
  options: PaymentProvider<
    TGlobalConfigurationSchema,
    TProductConfigurationSchema,
    TCreateGlobalKeyConfiguration,
    TCreateProductKeyConfiguration
  >
) => {
  return {
    ...options,
    validateGlobalConfiguration: (configuration: Record<string, unknown>) =>
      Schema.decodeUnknown(options.globalConfigurationSchema)(configuration),
    validateProductConfiguration: (configuration: Record<string, unknown>) =>
      Schema.decodeUnknown(options.productConfigurationSchema)(configuration)
  };
};

export const appStore = createPaymentProvider({
  id: 'apple-app-store',
  title: 'App Store',
  type: 'native',
  defaultProductConfiguration: {
    productId: ''
  },
  createGlobalKey: (configuration: { bundleId: string }) => {
    return `${configuration.bundleId}`;
  },
  createProductKey: (configuration: { productId: string }) => {
    return `${configuration.productId}`;
  },
  productConfigurationSchema: Schema.Struct({
    productId: Schema.String
  }),
  defaultGlobalConfiguration: {
    issuerId: '',
    bundleId: '',
    keyId: '',
    privateKey: ''
  },
  globalConfigurationSchema: Schema.Struct({
    issuerId: Schema.String.pipe(Schema.minLength(1)),
    bundleId: Schema.String.pipe(Schema.minLength(1)),
    keyId: Schema.String.pipe(Schema.minLength(1)),
    privateKey: Schema.String.pipe(Schema.minLength(1))
  })
});

export const stripe = createPaymentProvider({
  id: 'stripe',
  title: 'Stripe',
  type: 'web-checkout',
  defaultProductConfiguration: {
    productId: '',
    priceId: ''
  },
  createGlobalKey: (configuration: { secretKey: string }) => {
    return `${configuration.secretKey}`;
  },
  createProductKey: (configuration: { productId: string; priceId: string }) => {
    return `${configuration.productId}-${configuration.priceId}`;
  },
  productConfigurationSchema: Schema.Struct({
    productId: Schema.String.pipe(Schema.minLength(1)),
    priceId: Schema.String.pipe(Schema.minLength(1))
  }),
  defaultGlobalConfiguration: {
    secretKey: '',
    webhookSecret: ''
  },
  globalConfigurationSchema: Schema.Struct({
    secretKey: Schema.String.pipe(Schema.minLength(1)),
    webhookSecret: Schema.String.pipe(Schema.minLength(1))
  })
});

export const paymentProviders = [appStore, stripe] as const;
