import { Cause, Effect, Exit } from "effect";

import { CacheManager } from "../../src/core/caching/cache-manager";
import { schemaAtom } from "../../src/core/reactivity/client-state";
import type { RuntimeSchema } from "../../src/core/schema/runtime";
import { SchemaManager } from "../../src/core/schema/schema-manager";
import { FailedToFetchSchemaError } from "../../src/errors";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
} from "../helpers/effect-test-harness";
import { describe, expect, it } from "../helpers/effect-vitest";
import { createTestSchema } from "../helpers/test-schema";

/**
 * Poll `predicate` until it returns true (or `timeoutMs` elapses) without
 * relying on `vi.waitFor`, which isn't available under the project's bun
 * test runner.
 */
const waitFor = async (
  predicate: () => boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {},
) => {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const intervalMs = options.intervalMs ?? 5;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
};

const resolveSchemaEffect = (args: { distinctId: string; internalSchema?: RuntimeSchema }) =>
  Effect.flatMap(SchemaManager, (manager) => manager.resolveSchema(args));

const createAltSchema = (): RuntimeSchema => ({
  version: "sha256:alt",
  perks: {},
  locations: {},
  products: {},
});

describe("SchemaManager", () => {
  it("internalSchema bypasses cache and network and publishes to schemaAtom", async () => {
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    const internalSchema = createTestSchema();

    try {
      const result = await harness.runtime.runPromise(
        resolveSchemaEffect({
          distinctId: "user-1",
          internalSchema,
        }),
      );

      expect(result).toEqual(internalSchema);
      expect(apiDouble.state.getSchemaCalls).toHaveLength(0);
      expect(harness.atomRegistry.get(schemaAtom)).toEqual(internalSchema);
      // Cache should still be empty because we bypassed it entirely.
      const cached = await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.get<RuntimeSchema>("schema:1.0.0")),
      );
      expect(cached).toBeNull();
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("cache miss fetches from server, caches under appVersion key, and publishes to atom", async () => {
    const remoteSchema = createTestSchema();
    const apiDouble = createApiClientDouble({ getSchemaResult: remoteSchema });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    try {
      const result = await harness.runtime.runPromise(
        resolveSchemaEffect({ distinctId: "user-1" }),
      );

      expect(result).toEqual(remoteSchema);
      expect(apiDouble.state.getSchemaCalls).toHaveLength(1);
      expect(harness.atomRegistry.get(schemaAtom)).toEqual(remoteSchema);

      const cached = await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.get<RuntimeSchema>("schema:1.0.0")),
      );
      expect(cached?.value).toEqual(remoteSchema);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("cache hit returns cached value immediately and schedules a background refresh", async () => {
    const cachedSchema = createAltSchema();
    const refreshedSchema = createTestSchema();
    const apiDouble = createApiClientDouble({
      getSchemaResult: refreshedSchema,
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    try {
      // Prime the cache with a different schema so we can tell which one
      // is being returned.
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.set("schema:1.0.0", cachedSchema, {
            ttl: 1000 * 60 * 60 * 24 * 30,
          }),
        ),
      );

      const result = await harness.runtime.runPromise(
        resolveSchemaEffect({ distinctId: "user-1" }),
      );

      // The synchronous return value is the cached schema — what the
      // caller actually receives. (The atom transitions cached → refreshed
      // back-to-back in this test because every Effect is synchronous, so
      // we don't assert the intermediate atom state here.)
      expect(result).toEqual(cachedSchema);

      // The background refresh eventually lands the refreshed schema in
      // both the atom and the cache.
      await waitFor(
        () =>
          apiDouble.state.getSchemaCalls.length === 1 &&
          harness.atomRegistry.get(schemaAtom) === refreshedSchema,
      );
      expect(apiDouble.state.getSchemaCalls).toHaveLength(1);
      expect(harness.atomRegistry.get(schemaAtom)).toEqual(refreshedSchema);

      const cached = await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.get<RuntimeSchema>("schema:1.0.0")),
      );
      expect(cached?.value).toEqual(refreshedSchema);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("cache miss with failing fetch surfaces FailedToFetchSchemaError and leaves schemaAtom null", async () => {
    const apiDouble = createApiClientDouble({ getSchemaShouldFail: true });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });
    // Reset atom because it's a module-level singleton — other tests may
    // have left it populated.
    harness.atomRegistry.set(schemaAtom, null);

    try {
      const exit = await harness.runtime.runPromiseExit(
        resolveSchemaEffect({ distinctId: "user-1" }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.squash(exit.cause);
        expect(error).toBeInstanceOf(FailedToFetchSchemaError);
      }
      expect(harness.atomRegistry.get(schemaAtom)).toBeNull();
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("changing app version misses the cache and fetches fresh", async () => {
    const previousVersionSchema = createAltSchema();
    const remoteSchema = createTestSchema();
    const apiDouble = createApiClientDouble({ getSchemaResult: remoteSchema });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
      platform: { appVersion: "2.0.0" },
    });

    try {
      // Cache a schema under the OLD app version key — should not be used
      // when the harness is configured for "2.0.0".
      await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) =>
          manager.set("schema:1.0.0", previousVersionSchema, {
            ttl: 1000 * 60 * 60 * 24 * 30,
          }),
        ),
      );

      const result = await harness.runtime.runPromise(
        resolveSchemaEffect({ distinctId: "user-1" }),
      );

      expect(result).toEqual(remoteSchema);
      expect(apiDouble.state.getSchemaCalls).toHaveLength(1);

      const cachedForNewVersion = await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.get<RuntimeSchema>("schema:2.0.0")),
      );
      expect(cachedForNewVersion?.value).toEqual(remoteSchema);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("missing appVersion skips the cache and fetches synchronously", async () => {
    const remoteSchema = createTestSchema();
    const apiDouble = createApiClientDouble({ getSchemaResult: remoteSchema });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
      platform: { appVersion: undefined },
    });

    try {
      const result = await harness.runtime.runPromise(
        resolveSchemaEffect({ distinctId: "user-1" }),
      );

      expect(result).toEqual(remoteSchema);
      expect(apiDouble.state.getSchemaCalls).toHaveLength(1);
      expect(harness.atomRegistry.get(schemaAtom)).toEqual(remoteSchema);

      // No cache key should have been written.
      const cacheKeys = await harness.runtime.runPromise(
        Effect.flatMap(CacheManager, (manager) => manager.getCacheKeys()),
      );
      expect(cacheKeys.some((key) => key.startsWith("schema:"))).toBe(false);
    } finally {
      await harness.runtime.dispose();
    }
  });

  it("missing appVersion with failing fetch surfaces FailedToFetchSchemaError", async () => {
    const apiDouble = createApiClientDouble({ getSchemaShouldFail: true });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
      platform: { appVersion: undefined },
    });
    harness.atomRegistry.set(schemaAtom, null);

    try {
      const exit = await harness.runtime.runPromiseExit(
        resolveSchemaEffect({ distinctId: "user-1" }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.squash(exit.cause);
        expect(error).toBeInstanceOf(FailedToFetchSchemaError);
      }
    } finally {
      await harness.runtime.dispose();
    }
  });
});
