import { VoidhashError } from '../../errors';
import type { CacheManager } from '../caching/cache-manager';
import type { Logger } from '../logging';
import type { Api } from '../networking/api';

type CustomerAttributes = {
  email?: string;
  name?: string;
};

export class CustomerAttributeManager {
  private cacheManager: CacheManager;
  private logger: Logger;
  private api: Api;

  constructor(cacheManager: CacheManager, logger: Logger, api: Api) {
    this.cacheManager = cacheManager;
    this.logger = logger;
    this.api = api;
  }

  async getCustomerAttributes(appUserId: string) {
    const cachedCustomerAttributes =
      await this.cacheManager.get<CustomerAttributes>(
        this.generateCustomerAttributesCacheKey(appUserId)
      );

    if (cachedCustomerAttributes?.value) {
      return cachedCustomerAttributes.value;
    }

    return null;
  }

  async setCustomerAttributes(
    appUserId: string,
    attributes: CustomerAttributes
  ) {
    await this.cacheManager.set(
      this.generateCustomerAttributesCacheKey(appUserId),
      attributes
    );
  }

  async syncCustomerAttributes(appUserId: string) {
    let customerAttributes: CustomerAttributes | null =
      await this.getCustomerAttributes(appUserId);

    if (!customerAttributes) {
      customerAttributes = {
        email: undefined,
        name: undefined
      };
      await this.setCustomerAttributes(appUserId, customerAttributes);
    }

    const result = await this.api.syncCustomerAttributes(
      customerAttributes,
      appUserId
    );
    if (result.isErr()) {
      const err = result.error;
      this.logger.error('Failed to sync customer attributes', {
        err,
        appUserId
      });
      throw new VoidhashError(err.message);
    }

    // TODO: Handle result
    return;
  }

  private generateCustomerAttributesCacheKey(appUserId: string) {
    return `customer-attributes:${appUserId}`;
  }
}
