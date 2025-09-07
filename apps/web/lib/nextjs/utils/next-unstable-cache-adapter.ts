import { revalidateTag, unstable_cache } from 'next/cache';
import type { CacheAdapter } from '../../cache-adapter';

export class NextUnstableCacheAdapter implements CacheAdapter {
  /**
   * Adapts Next.js unstable_cache to the CacheAdapter interface
   */
  cacheFn<TData, TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<TData>,
    keys: string[],
    options?: {
      tags?: string[];
      revalidate?: number;
    }
  ): (...args: TArgs) => Promise<TData> {
    return unstable_cache(fn, keys, options);
  }

  /**
   * Invalidate the cache for a given key
   * @param key - The key to invalidate
   */
  invalidate(key: string): void {
    revalidateTag(key);
  }
}
