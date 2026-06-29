import { Effect, Layer, ManagedRuntime, pipe } from "effect";

import { CacheAdapter } from "../../src/core/caching/cache-adapter";
import { CacheManager } from "../../src/core/caching/cache-manager";
import { createInMemoryCacheAdapter } from "../helpers/effect-test-harness";
import { describe, expect, it } from "../helpers/effect-vitest";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("CacheManager", () => {
  it("returns value and metadata for set/get", async () => {
    const cache = createInMemoryCacheAdapter();
    const runtime = ManagedRuntime.make(
      pipe(
        CacheManager.Default,
        Layer.provideMerge(Layer.succeed(CacheAdapter, cache.adapter))
      )
    );

    try {
      await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.set("customer:1", { id: "1" }, { staleTime: 1000, ttl: 1000 })
        )
      );

      const result = await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.get<{ id: string }>("customer:1")
        )
      );

      expect(result).not.toBeNull();
      expect(result?.value).toEqual({ id: "1" });
      expect(result?.isExpired).toBe(false);
      expect(result?.isStale).toBe(false);
      expect(result?.createdAt).toEqual(expect.any(Number));
    } finally {
      await runtime.dispose();
    }
  });

  it("returns null and deletes expired entries", async () => {
    const cache = createInMemoryCacheAdapter();
    const runtime = ManagedRuntime.make(
      pipe(
        CacheManager.Default,
        Layer.provideMerge(Layer.succeed(CacheAdapter, cache.adapter))
      )
    );

    try {
      await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.set("customer:expired", { id: "expired" }, { ttl: 1 })
        )
      );
      await wait(5);

      const result = await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.get<{ id: string }>("customer:expired")
        )
      );

      expect(result).toBeNull();
      expect(cache.store.has("customer:expired")).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });

  it("marks stale entries as stale while still returning value", async () => {
    const cache = createInMemoryCacheAdapter();
    const runtime = ManagedRuntime.make(
      pipe(
        CacheManager.Default,
        Layer.provideMerge(Layer.succeed(CacheAdapter, cache.adapter))
      )
    );

    try {
      await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.set("customer:stale", { id: "stale" }, { staleTime: 1, ttl: 1000 })
        )
      );
      await wait(5);

      const result = await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.get<{ id: string }>("customer:stale")
        )
      );

      expect(result).not.toBeNull();
      expect(result?.value).toEqual({ id: "stale" });
      expect(result?.isStale).toBe(true);
      expect(result?.isExpired).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });

  it("clear removes tracked keys and cache index", async () => {
    const cache = createInMemoryCacheAdapter();
    const runtime = ManagedRuntime.make(
      pipe(
        CacheManager.Default,
        Layer.provideMerge(Layer.succeed(CacheAdapter, cache.adapter))
      )
    );

    try {
      await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          Effect.all([
            manager.set("k1", "v1"),
            manager.set("k2", "v2"),
            manager.clear(),
          ])
        )
      );

      const keys = await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.getCacheKeys())
      );
      const k1 = await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.get<string>("k1"))
      );
      const k2 = await runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.get<string>("k2"))
      );

      expect(keys).toEqual([]);
      expect(k1).toBeNull();
      expect(k2).toBeNull();
      expect(cache.store.has("cache-keys")).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });
});
