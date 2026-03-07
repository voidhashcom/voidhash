export interface CacheAdapter {
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  keys(): Promise<ReadonlyArray<string>>;
  set(key: string, value: string): Promise<void>;
}

interface CacheEnvelope<T> {
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly staleAt: number | null;
  readonly value: T;
}

export interface CacheHit<T> extends CacheEnvelope<T> {
  readonly isExpired: boolean;
  readonly isStale: boolean;
}

const CACHE_INDEX_SUFFIX = "__keys__";

export class CacheManager {
  private memoryIndex = new Set<string>();
  private readonly persistentIndexKey: string;

  constructor(
    private readonly namespace: string,
    private readonly memory: CacheAdapter,
    private readonly persistent: CacheAdapter | null
  ) {
    this.persistentIndexKey = this.buildStorageKey(CACHE_INDEX_SUFFIX);
  }

  async clearAll() {
    const keys = await this.getCacheKeys();
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async clearPrefix(prefix: string) {
    const keys = await this.getCacheKeys();
    const matchedKeys = keys.filter((key) => key.startsWith(prefix));
    await Promise.all(matchedKeys.map((key) => this.delete(key)));
  }

  async delete(key: string) {
    const storageKey = this.buildStorageKey(key);
    await this.memory.delete(storageKey);
    if (this.persistent) {
      await this.persistent.delete(storageKey);
    }
    this.memoryIndex.delete(storageKey);
    await this.persistIndex();
  }

  async get<T>(key: string): Promise<CacheHit<T> | null> {
    const storageKey = this.buildStorageKey(key);
    const rawValue =
      (await this.memory.get(storageKey)) ??
      (this.persistent ? await this.persistent.get(storageKey) : null);

    if (!rawValue) {
      return null;
    }

    const cachedValue = JSON.parse(rawValue) as CacheEnvelope<T>;
    const isExpired =
      typeof cachedValue.expiresAt === "number"
        ? cachedValue.expiresAt < Date.now()
        : false;
    const isStale =
      typeof cachedValue.staleAt === "number"
        ? cachedValue.staleAt < Date.now()
        : false;

    if (isExpired) {
      await this.delete(key);
      return null;
    }

    if (!(await this.memory.get(storageKey))) {
      await this.memory.set(storageKey, rawValue);
    }

    await this.rememberKey(storageKey);

    return {
      ...cachedValue,
      isExpired,
      isStale,
    };
  }

  async getCacheKeys() {
    const storageKeys = await this.loadIndexedStorageKeys();
    const keys = new Set<string>([
      ...this.memoryIndex,
      ...storageKeys,
    ]);

    return [...keys]
      .filter((key) => key.startsWith(`${this.namespace}:`))
      .filter((key) => key !== this.persistentIndexKey)
      .map((key) => key.slice(this.namespace.length + 1));
  }

  async set<T>(
    key: string,
    value: T,
    options?: { staleTime?: number; ttl?: number }
  ) {
    const storageKey = this.buildStorageKey(key);
    const envelope: CacheEnvelope<T> = {
      createdAt: Date.now(),
      expiresAt: options?.ttl ? Date.now() + options.ttl : null,
      staleAt: options?.staleTime ? Date.now() + options.staleTime : null,
      value,
    };
    const serialized = JSON.stringify(envelope);

    await this.memory.set(storageKey, serialized);
    if (this.persistent) {
      await this.persistent.set(storageKey, serialized);
    }

    await this.rememberKey(storageKey);
  }

  private buildStorageKey(key: string) {
    return `${this.namespace}:${key}`;
  }

  private async loadIndexedStorageKeys() {
    if (!this.persistent) {
      return [];
    }

    const rawIndex = await this.persistent.get(this.persistentIndexKey);
    if (!rawIndex) {
      return [];
    }

    try {
      return JSON.parse(rawIndex) as string[];
    } catch {
      return [];
    }
  }

  private async persistIndex() {
    const serialized = JSON.stringify([...this.memoryIndex]);
    await this.memory.set(this.persistentIndexKey, serialized);
    if (this.persistent) {
      await this.persistent.set(this.persistentIndexKey, serialized);
    }
  }

  private async rememberKey(storageKey: string) {
    if (storageKey === this.persistentIndexKey) {
      return;
    }

    this.memoryIndex.add(storageKey);
    await this.persistIndex();
  }
}
