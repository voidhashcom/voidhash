import type { SdkCustomer } from '@voidhash/api-spec';
import { Effect } from 'effect';
import { CacheManager } from '../caching/cache-manager';
import { EventBusProvider } from '../event-bus';
import { ApiClient } from '../networking/api-client';
import { getCommonSdkHeaders } from '../utils/get-common-sdk-headers';

export class CustomerInfoManager extends Effect.Service<CustomerInfoManager>()(
  'rn-voidhash/CustomerInfoManager',
  {
    dependencies: [CacheManager.Default, ApiClient.Default],
    effect: Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      const apiClient = yield* ApiClient;
      const eventBus = yield* EventBusProvider;

      const generateCustomerCacheKey = (appUserId: string) =>
        `customer:${appUserId}`;

      const getCustomerFromCache = (appUserId: string) =>
        cacheManager.get<SdkCustomer>(generateCustomerCacheKey(appUserId));

      const cache = (appUserId: string, customer: SdkCustomer) =>
        cacheManager.set(generateCustomerCacheKey(appUserId), customer, {
          ttl: 1000 * 60 * 60 * 24 * 2, // 2 days
          staleTime: 1000 * 60 * 5 // 5 minutes
        });

      const resetCache = (appUserId: string) =>
        cacheManager.delete(generateCustomerCacheKey(appUserId));

      const getCustomerFromServerAndCache = (appUserId: string) =>
        Effect.gen(function* () {
          const commonHeaders = yield* getCommonSdkHeaders();
          const result = yield* apiClient.sdk.getCustomer({
            headers: {
              ...commonHeaders,
              'x-app-user-id': appUserId
            }
          });
          eventBus.emit('customer-fetched', result);
          yield* cache(appUserId, result);
          return result;
        });

      const getCustomer = (
        appUserId: string,
        cachePolicy: 'cache' | 'fetch' | 'fetch-while-stale'
      ) =>
        Effect.gen(function* () {
          if (cachePolicy === 'cache') {
            const customerFromCache = yield* getCustomerFromCache(appUserId);
            return customerFromCache?.value ?? null;
          }

          if (cachePolicy === 'fetch') {
            return yield* getCustomerFromServerAndCache(appUserId);
          }

          // fetch-while-stale policy
          const customerFromCache = yield* getCustomerFromCache(appUserId);
          if (
            customerFromCache &&
            !customerFromCache.isStale &&
            !customerFromCache.isExpired &&
            customerFromCache.value
          ) {
            return customerFromCache.value;
          }

          return yield* getCustomerFromServerAndCache(appUserId);
        });

      return {
        getCustomer,
        getCustomerFromCache,
        cache,
        resetCache
      } as const;
    })
  }
) {}
