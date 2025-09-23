import type { EnvironmentValue } from '@voidhash/lib';
import type { Schema } from 'effect';

export type ApiKey = {
  key: string;
  rawKey?: string;
  environment: EnvironmentValue;
  isPublic: boolean;
  end: string;
  prefix: string;
};

export type CustomerMetadata = {
  appUserId: string;
  publishableKey: string;
  platform: string;
  sdk: 'react-native';
  sdkVersion: string;
  platformFlavor: 'native';
  platformFlavorVersion?: string;
  platformVersion?: string;
  platformDevice?: string;
  platformBrand?: string;
  preferredLocales?: string;
  clientLocale?: string;
  clientVersion?: string;
  clientBundleId: string;
  observerMode: 'false';
  nonce?: string;
  storefront?: string;
  isDebugBuild: 'true' | 'false';
  isBackgrounded: 'false';
};

export type PaymentProvider<
  TGlobalConfigurationSchema,
  TProductConfigurationSchema,
  TCreateGlobalKeyConfiguration extends object,
  TCreateProductKeyConfiguration extends object
> = {
  id: string;
  type: 'native' | 'web-checkout';
  title: string;
  createGlobalKey: (configuration: TCreateGlobalKeyConfiguration) => string;
  defaultGlobalConfiguration: Schema.Schema.Type<TGlobalConfigurationSchema>;
  globalConfigurationSchema: TGlobalConfigurationSchema;
  createProductKey: (configuration: TCreateProductKeyConfiguration) => string;
  defaultProductConfiguration: Schema.Schema.Type<TProductConfigurationSchema>;
  productConfigurationSchema: TProductConfigurationSchema;
};
