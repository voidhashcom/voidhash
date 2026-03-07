import { VoidhashStorageError } from "../../../errors";
import type { CacheAdapter } from "../cache-manager";

export class LocalStorageCacheAdapter implements CacheAdapter {
  static create() {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    try {
      const probeKey = "__voidhash_probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      return new LocalStorageCacheAdapter(window.localStorage);
    } catch {
      return null;
    }
  }

  constructor(private readonly storage: Storage) {}

  async delete(key: string) {
    try {
      this.storage.removeItem(key);
    } catch (error) {
      throw new VoidhashStorageError("Failed to delete from localStorage.", {
        cause: error,
      });
    }
  }

  async get(key: string) {
    try {
      return this.storage.getItem(key);
    } catch (error) {
      throw new VoidhashStorageError("Failed to read from localStorage.", {
        cause: error,
      });
    }
  }

  async keys() {
    try {
      return Array.from({ length: this.storage.length }, (_, index) =>
        this.storage.key(index)
      ).filter((key): key is string => typeof key === "string");
    } catch (error) {
      throw new VoidhashStorageError("Failed to enumerate localStorage.", {
        cause: error,
      });
    }
  }

  async set(key: string, value: string) {
    try {
      this.storage.setItem(key, value);
    } catch (error) {
      throw new VoidhashStorageError("Failed to write to localStorage.", {
        cause: error,
      });
    }
  }
}
