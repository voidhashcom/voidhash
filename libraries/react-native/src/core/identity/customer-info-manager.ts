import { VoidhashError } from '../../errors';
import type { CacheManager } from '../caching/cache-manager';
import type { EventBus } from '../event-bus';
import type { Logger } from '../logging';
import type { Api } from '../networking/api';
import type { Customer } from '../networking/types';

export class CustomerInfoManager {
  private cacheManager: CacheManager;
  private logger: Logger;
  private api: Api;
  private eventBus: EventBus;

  constructor(
    cacheManager: CacheManager,
    logger: Logger,
    api: Api,
    eventBus: EventBus
  ) {
    this.cacheManager = cacheManager;
    this.logger = logger;
    this.api = api;
    this.eventBus = eventBus;
  }

  private generateCustomerCacheKey(appUserId: string) {
    return `customer:${appUserId}`;
  }

  async getCustomer(
    appUserId: string,
    cachePolicy: 'cache' | 'fetch' | 'fetch-while-stale'
  ) {
    if (cachePolicy === 'cache') {
      const customerFromCache = await this.getCustomerFromCache(appUserId);
      return customerFromCache?.value ?? null;
    }

    if (cachePolicy === 'fetch') {
      return await this.getCustomerFromServerAndCache(appUserId);
    }

    const customerFromCache = await this.getCustomerFromCache(appUserId);
    if (
      !customerFromCache?.isStale &&
      customerFromCache?.isExpired &&
      customerFromCache?.value
    ) {
      return customerFromCache.value;
    }

    return await this.getCustomerFromServerAndCache(appUserId);
  }

  async getCustomerFromCache(appUserId: string) {
    return await this.cacheManager.get<Customer>(
      this.generateCustomerCacheKey(appUserId)
    );
  }

  async cache(appUserId: string, customer: Customer) {
    await this.cacheManager.set(
      this.generateCustomerCacheKey(appUserId),
      customer,
      {
        ttl: 1000 * 60 * 60 * 24 * 2, // 2 days
        staleTime: 1000 * 60 * 5 // 5 minute
      }
    );
  }

  async resetCache(appUserId: string) {
    await this.cacheManager.delete(this.generateCustomerCacheKey(appUserId));
  }

  private async getCustomerFromServerAndCache(appUserId: string) {
    const result = await this.api.getCustomer(appUserId);

    if (result.isErr()) {
      const err = result.error;
      this.logger.error('Failed to get customer from server', {
        err,
        appUserId
      });
      throw new VoidhashError(err.message);
    }

    if (result.value) {
      this.eventBus.emit('customer-fetched', result.value);
      await this.cache(appUserId, result.value);
    }

    return result.value;
  }
}
