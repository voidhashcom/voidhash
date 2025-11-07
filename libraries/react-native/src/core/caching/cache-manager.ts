import { Effect } from 'effect';
import { CacheAdapter } from './cache-adapter';

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
export class CacheManager extends Effect.Service<CacheManager>()(
  'rn-voidhash/CacheManager',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const cache = yield* CacheAdapter;
      const get = <T>(key: string) =>
        Effect.gen(function* () {
          const cachedValue = yield* cache.get(key);
          if (cachedValue) {
            const cacheHit = JSON.parse(cachedValue) as CacheEnvelope<T>;

            const isExpired = cacheHit.expiresAt
              ? cacheHit.expiresAt < Date.now()
              : false;
            const isStale = cacheHit.staleAt
              ? cacheHit.staleAt < Date.now()
              : false;

            if (isExpired) {
              yield* deleteValue(key);
              return null;
            }

            return {
              ...cacheHit,
              isExpired,
              isStale
            } satisfies CacheHit<T>;
          }
          return null;
        });

      const setValue = <T>(
        key: string,
        value: T,
        options?: { ttl?: number; staleTime?: number }
      ) =>
        Effect.all([
          cache.set(
            key,
            JSON.stringify({
              value,
              expiresAt: options?.ttl ? Date.now() + options.ttl : null,
              staleAt: options?.staleTime
                ? Date.now() + options.staleTime
                : null,
              createdAt: Date.now()
            } satisfies CacheEnvelope<T>)
          ),
          storeCacheKey(key)
        ]);

      const deleteValue = (key: string) => cache.delete(key);

      const clear = () =>
        Effect.gen(function* () {
          const cacheKeys = yield* getCacheKeys();
          yield* Effect.all(cacheKeys.map((key) => cache.delete(key)));
          yield* cache.delete(CACHE_KEYS_KEY);
        });

      const getCacheKeys = () =>
        Effect.gen(function* () {
          const cacheKeys = yield* cache.get(CACHE_KEYS_KEY);
          if (cacheKeys) {
            return JSON.parse(cacheKeys) as string[];
          }
          return [];
        });

      const storeCacheKey = (key: string) =>
        Effect.gen(function* () {
          const cacheKeys = yield* cache.get(CACHE_KEYS_KEY);
          if (cacheKeys) {
            const cacheKeysArray = JSON.parse(cacheKeys) as string[];
            cacheKeysArray.push(key);
            yield* cache.set(CACHE_KEYS_KEY, JSON.stringify(cacheKeysArray));
          } else {
            yield* cache.set(CACHE_KEYS_KEY, JSON.stringify([key]));
          }
        });

      return {
        get,
        set: setValue,
        delete: deleteValue,
        clear,
        getCacheKeys
      } as const;
    })
  }
) {}
