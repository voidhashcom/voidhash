/**
 * Cache interface that mimics Next.js unstable_cache API
 * Allows for different implementations to be swapped in as needed
 */
export interface CacheAdapter {
	/**
	 * Cache a function's result with a given key and options
	 * @param fn - Function to cache the results of
	 * @param keys - Array of strings to use as cache keys
	 * @param options - Cache options including tags and revalidation time
	 * @returns A function that returns the cached value or recalculates it
	 */
	cacheFn<TData, TArgs extends unknown[]>(
		fn: (...args: TArgs) => Promise<TData>,
		keys: string[],
		options?: {
			tags?: string[];
			revalidate?: number;
		}
	): (...args: TArgs) => Promise<TData>;

	/**
	 * Invalidate the cache for a given key
	 * @param key - The key to invalidate
	 */
	invalidate(key: string): void;
}
