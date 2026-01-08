/**
 * Integration tests for redis-operations-log
 *
 * Requires Redis to be running (via docker-compose).
 * Tests actual Redis operations with real data.
 */

import { Effect, Exit, Option } from "effect";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  layer as redisLayer,
  RedisOperationsLogTag,
  type RedisConfig,
} from "../redis-operations-log";
import { CURRENT_SCHEMA_VERSION } from "../schema-migration";

// Test config - uses local Redis from docker-compose
const testConfig: RedisConfig = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
};

// Unique prefix for test isolation
const testPrefix = `test-${Date.now()}`;
const testPaywallId = (id: string) => `${testPrefix}-${id}`;

describe("redis-operations-log integration", () => {
  const layer = redisLayer(testConfig);

  // Clean up test keys after all tests
  afterAll(async () => {
    // Redis keys will expire via TTL, but we can clean up explicitly if needed
  });

  describe("saveState and loadState", () => {
    test("should save and load state from real Redis", async () => {
      const paywallId = testPaywallId("save-load");
      const state = { name: "Test Paywall", children: [{ type: "screen" }] };

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          // Save state
          yield* redis.saveState(paywallId, state, 1);

          // Load state
          const loaded = yield* redis.loadState(paywallId);

          expect(Option.isSome(loaded)).toBe(true);
          if (Option.isSome(loaded)) {
            expect(loaded.value.state).toEqual(state);
            expect(loaded.value.version).toBe(1);
            expect(loaded.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
            expect(loaded.value.timestamp).toBeLessThanOrEqual(Date.now());
          }

          // Cleanup
          yield* redis.deleteState(paywallId);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should handle large state objects", async () => {
      const paywallId = testPaywallId("large-state");
      const largeState = {
        name: "Large Paywall",
        children: Array.from({ length: 100 }, (_, i) => ({
          id: `node-${i}`,
          name: `Node ${i}`,
          style: {
            backgroundColor: "#ffffff",
            height: 100 + i,
            width: 200 + i,
          },
          type: "element",
        })),
      };

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          yield* redis.saveState(paywallId, largeState, 1);

          const loaded = yield* redis.loadState(paywallId);
          expect(Option.isSome(loaded)).toBe(true);
          if (Option.isSome(loaded)) {
            expect(loaded.value.state).toEqual(largeState);
          }

          yield* redis.deleteState(paywallId);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should update state with new version", async () => {
      const paywallId = testPaywallId("update-version");

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          // Save v1
          yield* redis.saveState(paywallId, { name: "V1" }, 1);

          // Save v2
          yield* redis.saveState(paywallId, { name: "V2" }, 2);

          // Save v3
          yield* redis.saveState(paywallId, { name: "V3" }, 3);

          const loaded = yield* redis.loadState(paywallId);
          expect(Option.isSome(loaded)).toBe(true);
          if (Option.isSome(loaded)) {
            expect(loaded.value.state).toEqual({ name: "V3" });
            expect(loaded.value.version).toBe(3);
          }

          yield* redis.deleteState(paywallId);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("setCheckpoint and getCheckpoint", () => {
    test("should save and retrieve checkpoint", async () => {
      const paywallId = testPaywallId("checkpoint");
      const checkpoint = `checkpoint-${Date.now()}-5`;

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          yield* redis.setCheckpoint(paywallId, checkpoint);

          const loaded = yield* redis.getCheckpoint(paywallId);
          expect(Option.isSome(loaded)).toBe(true);
          if (Option.isSome(loaded)) {
            expect(loaded.value).toBe(checkpoint);
          }

          yield* redis.deleteState(paywallId);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should update checkpoint", async () => {
      const paywallId = testPaywallId("checkpoint-update");

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          yield* redis.setCheckpoint(paywallId, "cp-1");
          yield* redis.setCheckpoint(paywallId, "cp-2");
          yield* redis.setCheckpoint(paywallId, "cp-3");

          const loaded = yield* redis.getCheckpoint(paywallId);
          expect(Option.isSome(loaded)).toBe(true);
          if (Option.isSome(loaded)) {
            expect(loaded.value).toBe("cp-3");
          }

          yield* redis.deleteState(paywallId);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("deleteState", () => {
    test("should delete state and checkpoint", async () => {
      const paywallId = testPaywallId("delete");

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          // Set up data
          yield* redis.saveState(paywallId, { name: "Test" }, 1);
          yield* redis.setCheckpoint(paywallId, "cp-1");

          // Verify exists
          expect(Option.isSome(yield* redis.loadState(paywallId))).toBe(true);
          expect(Option.isSome(yield* redis.getCheckpoint(paywallId))).toBe(true);

          // Delete
          yield* redis.deleteState(paywallId);

          // Verify deleted
          expect(Option.isNone(yield* redis.loadState(paywallId))).toBe(true);
          expect(Option.isNone(yield* redis.getCheckpoint(paywallId))).toBe(true);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("concurrent operations", () => {
    test("should handle concurrent saves to different paywalls", async () => {
      const paywallIds = Array.from({ length: 10 }, (_, i) =>
        testPaywallId(`concurrent-${i}`)
      );

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          // Save all concurrently
          yield* Effect.forEach(
            paywallIds,
            (id, i) => redis.saveState(id, { name: `Paywall ${i}` }, i + 1),
            { concurrency: "unbounded" }
          );

          // Verify all saved correctly
          const loaded = yield* Effect.forEach(
            paywallIds,
            (id) => redis.loadState(id),
            { concurrency: "unbounded" }
          );

          loaded.forEach((item, i) => {
            expect(Option.isSome(item)).toBe(true);
            if (Option.isSome(item)) {
              expect(item.value.state).toEqual({ name: `Paywall ${i}` });
              expect(item.value.version).toBe(i + 1);
            }
          });

          // Cleanup
          yield* Effect.forEach(paywallIds, (id) => redis.deleteState(id), {
            concurrency: "unbounded",
          });
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should handle rapid updates to same paywall", async () => {
      const paywallId = testPaywallId("rapid-updates");

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          // Rapid sequential updates
          for (let i = 1; i <= 50; i++) {
            yield* redis.saveState(paywallId, { version: i }, i);
          }

          const loaded = yield* redis.loadState(paywallId);
          expect(Option.isSome(loaded)).toBe(true);
          if (Option.isSome(loaded)) {
            expect(loaded.value.state).toEqual({ version: 50 });
            expect(loaded.value.version).toBe(50);
          }

          yield* redis.deleteState(paywallId);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });
});
