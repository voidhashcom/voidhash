import type { CacheAdapter } from './types';

const CACHE_KEYS_KEY = 'cache-keys';

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number | null;
  createdAt: number;
  staleAt: number | null;
};

type CacheHit<T> = CacheEnvelope<T> & {
  isStale: boolean;
  isExpired: boolean;
};

export class CacheManager {
  private cache: CacheAdapter;

  constructor(cache: CacheAdapter) {
    this.cache = cache;
  }

  async get<T>(key: string): Promise<CacheHit<T> | null> {
    const cachedValue = await this.cache.get(key);
    if (cachedValue) {
      const cacheHit = JSON.parse(cachedValue) as CacheEnvelope<T>;

      const isExpired = cacheHit.expiresAt
        ? cacheHit.expiresAt < Date.now()
        : false;
      const isStale = cacheHit.staleAt ? cacheHit.staleAt < Date.now() : false;

      if (isExpired) {
        await this.delete(key);
        return null;
      }

      return {
        ...cacheHit,
        isExpired,
        isStale
      } satisfies CacheHit<T>;
    }
    return null;
  }

  async set<T>(
    key: string,
    // biome-ignore lint/suspicious/noExplicitAny: required here
    value: T extends CacheEnvelope<any> ? never : T,
    options?: { ttl?: number; staleTime?: number }
  ): Promise<void> {
    const envelope = {
      value,
      expiresAt: options?.ttl ? Date.now() + options.ttl : null,
      staleAt: options?.staleTime ? Date.now() + options.staleTime : null,
      createdAt: Date.now()
    } satisfies CacheEnvelope<T>;

    await Promise.all([
      this.cache.set(key, JSON.stringify(envelope)),
      this.storeCacheKey(key)
    ]);
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }

  async clear(): Promise<void> {
    const cacheKeys = await this.getCacheKeys();
    await Promise.all(cacheKeys.map((key) => this.cache.delete(key)));
    await this.cache.delete(CACHE_KEYS_KEY);
  }

  private async storeCacheKey(key: string): Promise<void> {
    const cacheKeys = await this.cache.get(CACHE_KEYS_KEY);
    if (cacheKeys) {
      const cacheKeysArray = JSON.parse(cacheKeys) as string[];
      cacheKeysArray.push(key);
      await this.cache.set(CACHE_KEYS_KEY, JSON.stringify(cacheKeysArray));
    } else {
      await this.cache.set(CACHE_KEYS_KEY, JSON.stringify([key]));
    }
  }

  private async getCacheKeys(): Promise<string[]> {
    const cacheKeys = await this.cache.get(CACHE_KEYS_KEY);
    if (cacheKeys) {
      return JSON.parse(cacheKeys) as string[];
    }
    return [];
  }
}
