import { ANONYMOUS_USER_ID_PREFIX } from '../../constants';
import { VoidhashError } from '../../errors';
import type { CacheManager } from '../caching/cache-manager';
import type { EventBus } from '../event-bus';
import type { Logger } from '../logging';
import type { Api } from '../networking/api';
import type { CustomerAttributeManager } from './customer-attribute-manager';
import type { CustomerInfoManager } from './customer-info-manager';

const CACHE_KEY = 'appUserId';

export class IdentityManager {
  private cacheManager: CacheManager;
  private logger: Logger;
  private customerInfoManager: CustomerInfoManager;
  private customerAttributeManager: CustomerAttributeManager;
  private api: Api;
  private eventBus: EventBus;
  constructor(
    cacheManager: CacheManager,
    logger: Logger,
    customerInfoManager: CustomerInfoManager,
    customerAttributeManager: CustomerAttributeManager,
    api: Api,
    eventBus: EventBus
  ) {
    this.cacheManager = cacheManager;
    this.logger = logger;
    this.customerInfoManager = customerInfoManager;
    this.customerAttributeManager = customerAttributeManager;
    this.api = api;
    this.eventBus = eventBus;
  }

  /**
   * Returns the app user id. If no app user id is cached, a new anonymous user id is generated and cached.
   * @returns The app user id.
   */
  async getAppUserId() {
    const cachedAppUserId = await this.getAppUserIdFromCache();

    if (cachedAppUserId) {
      this.logger.debug('Using cached app user id', { cachedAppUserId });
      return cachedAppUserId;
    }

    const anonymousUserId = this.generateAnonymousUserId();
    this.logger.debug('Generated anonymous user id', { anonymousUserId });
    await this.cacheManager.set(CACHE_KEY, anonymousUserId);

    return anonymousUserId;
  }

  /**
   * Returns the app user id from cache.
   * @returns The app user id.
   */
  async getAppUserIdFromCache() {
    const cachedAppUserId = await this.cacheManager.get<string>(CACHE_KEY);
    return cachedAppUserId?.value ?? null;
  }

  /**
   * Sets the app user id in cache.
   * @param appUserId - The app user id.
   */
  private async setAppUserIdInCache(appUserId: string) {
    await this.cacheManager.set(CACHE_KEY, appUserId);
  }

  /**
   * Identifies the customer. It makes a request to the server to identify the customer and caches the app user id.
   * @param appUserId - The app user id.
   * @param options - The options.
   */
  async identify(
    appUserId: string,
    options: {
      email?: string;
      name?: string;
    }
  ) {
    const currentAppUserId = await this.getAppUserId();
    await this.customerAttributeManager.syncCustomerAttributes(
      currentAppUserId
    );
    const identifyRequest = await this.api.identifyCustomer(
      {
        appUserId,
        ...options
      },
      currentAppUserId
    );

    if (identifyRequest.isErr()) {
      const err = identifyRequest.error;
      // TODO: Handle errors
      throw new VoidhashError(err.message);
    }

    await Promise.all([
      this.setAppUserIdInCache(appUserId),
      this.customerInfoManager.cache(appUserId, identifyRequest.value)
    ]);

    this.eventBus.emit('customer-identified');
    this.eventBus.emit('customer-fetched', identifyRequest.value);
  }

  async signOut() {
    const currentAppUserId = await this.getAppUserId();
    await this.customerAttributeManager.syncCustomerAttributes(
      currentAppUserId
    );
    await this.cacheManager.clear();
    this.eventBus.emit('customer-signed-out');
  }

  private generateAnonymousUserId() {
    return `${ANONYMOUS_USER_ID_PREFIX}${Math.random().toString(36).substring(2, 15)}`;
  }
}
