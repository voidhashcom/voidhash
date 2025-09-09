import Constants from 'expo-constants';
import { Platform as RNPlatform } from 'react-native';
import { VoidhashClient, type VoidhashClientOptions } from './client';
import { EventBus } from './core/event-bus';
import type { VoidhashSchema } from './core/schema';
import { SchemeNotSetError } from './errors';
import { voidhashProviderFactory } from './react/components/provider';
import { useRetrieveAppStoreProduct } from './react/hooks/app-store/use-retrieve-app-store-product';
import { useRetrieveAppStoreProducts } from './react/hooks/app-store/use-retrieve-app-store-products';
import { useRetrieveGooglePlayProduct } from './react/hooks/google-play/use-retrieve-google-play-product';
import { useRetrieveGooglePlayProducts } from './react/hooks/google-play/use-retrieve-google-play-products';
import { currentCustomerHookFactory } from './react/hooks/use-customer';
import { productsHookFactory } from './react/hooks/use-products';
import { purchaseHookFactory } from './react/hooks/use-purchase';

export function createVoidhashClient<TSchema extends VoidhashSchema>(
  publishableKey: string,
  schema: VoidhashClientOptions<TSchema>['schema'],
  options: Omit<VoidhashClientOptions<TSchema>, 'schema'>
) {
  const baseUrl = options.baseUrl || 'https://api.voidhash.com';
  const initialAppUserId = options.userId ?? null;
  const scheme =
    options.scheme ??
    (typeof Constants.expoConfig?.scheme === 'string'
      ? Constants.expoConfig?.scheme
      : Constants.expoConfig?.scheme?.[0]);

  if (!scheme) {
    throw new SchemeNotSetError();
  }

  const eventBus = new EventBus();
  const platform = RNPlatform.OS === 'ios' ? 'ios' : 'android';

  const client = new VoidhashClient<TSchema>(
    initialAppUserId,
    scheme,
    schema,
    baseUrl,
    publishableKey,
    eventBus,
    platform
  );

  const { provider, context, useVoidhash } = voidhashProviderFactory(client);

  return {
    client,
    Provider: provider,
    useVoidhash,
    usePurchase: purchaseHookFactory(client),
    useProducts: productsHookFactory(client, context),
    useCurrentCustomer: currentCustomerHookFactory(client, context),
    googlePlay: {
      useRetrieveProduct: useRetrieveGooglePlayProduct,
      useRetrieveProducts: useRetrieveGooglePlayProducts
    },
    appStore: {
      useRetrieveProduct: useRetrieveAppStoreProduct,
      useRetrieveProducts: useRetrieveAppStoreProducts
    }
  };
}
