import type { CacheAdapter } from "../cache-manager";

export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, string>();

  async delete(key: string) {
    this.store.delete(key);
  }

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async keys() {
    return [...this.store.keys()];
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
  }
}
