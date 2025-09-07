import type { CacheAdapter } from '../caching/types';

export class TestCacheAdapter implements CacheAdapter {
  data: Record<string, string> = {};
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.data[key] ?? null);
  }
  set(key: string, value: string): Promise<void> {
    this.data[key] = value;
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    delete this.data[key];
    return Promise.resolve();
  }
}
