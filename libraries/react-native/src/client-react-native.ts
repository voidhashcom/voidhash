import Constants from 'expo-constants';
import { VoidhashClient, type VoidhashClientOptions } from './client';
import { asyncStorageCacheAdapter } from './core/caching/async-storage-cache';
import { CacheManager } from './core/caching/cache-manager';
import { EventBus } from './core/event-bus';
import { CustomerAttributeManager } from './core/identity/customer-attribute-manager';
import { CustomerInfoManager } from './core/identity/customer-info-manager';
import { IdentityManager } from './core/identity/identity-manager';
import { Logger, LogLevel } from './core/logging';
import { createApi } from './core/networking/api';
import { HttpClient } from './core/networking/http-client';
import { createPaymentAdapter } from './core/payment-adapters/payment-adapter';
import { ReactNativePlatformProvider } from './core/platform/platform';
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

  const logger = new Logger(
    'VoidhashClient',
    options.debug ? LogLevel.DEBUG : LogLevel.INFO
  );
  const eventBus = new EventBus();
  const platformProvider = new ReactNativePlatformProvider();

  const cacheManager = new CacheManager(asyncStorageCacheAdapter());
  const httpClient = new HttpClient({
    publishableKey,
    baseUrl,
    platformProvider,
    logger
  });
  const api = createApi(httpClient);
  const customerInfoManager = new CustomerInfoManager(
    cacheManager,
    logger,
    api,
    eventBus
  );
  const customerAttributeManager = new CustomerAttributeManager(
    cacheManager,
    logger,
    api
  );
  const identityManager = new IdentityManager(
    cacheManager,
    logger,
    customerInfoManager,
    customerAttributeManager,
    api,
    eventBus
  );

  const paymentAdapter = createPaymentAdapter(platformProvider, logger);

  const client = new VoidhashClient<TSchema>(
    initialAppUserId,
    scheme,
    logger,
    cacheManager,
    customerInfoManager,
    identityManager,
    customerAttributeManager,
    schema,
    paymentAdapter,
    eventBus,
    platformProvider,
    httpClient
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
