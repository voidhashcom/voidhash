/**
 * Unit tests for redis-operations-log
 *
 * Uses mocked Redis client to test the service logic without actual Redis.
 * Integration tests with real Redis are in redis-operations-log.integration.test.ts
 */

import { Context, Effect, Exit, Layer, Option } from "effect";
import { describe, expect, test, vi } from "vitest";

import { RedisOperationError } from "../errors";
import {
  RedisOperationsLogTag,
  type RedisOperationsLog,
  type RedisStateSnapshot,
} from "../redis-operations-log";
import { CURRENT_SCHEMA_VERSION } from "../schema-migration";

/**
 * Create a mock Redis operations log for testing
 */
const createMockRedisOperationsLog = () => {
  const storage = new Map<string, string>();

  const mock: RedisOperationsLog = {
    saveState: (paywallId, state, version) =>
      Effect.sync(() => {
        const snapshot: RedisStateSnapshot = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          state,
          timestamp: Date.now(),
          version,
        };
        storage.set(`state:${paywallId}`, JSON.stringify(snapshot));
      }),

    loadState: (paywallId) =>
      Effect.sync(() => {
        const data = storage.get(`state:${paywallId}`);
        if (!data) {
          return Option.none();
        }
        return Option.some(JSON.parse(data) as RedisStateSnapshot);
      }),

    setCheckpoint: (paywallId, checkpoint) =>
      Effect.sync(() => {
        storage.set(`checkpoint:${paywallId}`, checkpoint);
      }),

    getCheckpoint: (paywallId) =>
      Effect.sync(() => {
        const data = storage.get(`checkpoint:${paywallId}`);
        return data ? Option.some(data) : Option.none();
      }),

    deleteState: (paywallId) =>
      Effect.sync(() => {
        storage.delete(`state:${paywallId}`);
        storage.delete(`checkpoint:${paywallId}`);
      }),

    close: () => Effect.void,
  };

  return {
    mock,
    storage,
    layer: Layer.succeed(RedisOperationsLogTag, mock),
  };
};

/**
 * Create a mock that always fails for testing error handling
 */
const createFailingMockRedisOperationsLog = () => {
  const mock: RedisOperationsLog = {
    saveState: (paywallId) =>
      Effect.fail(
        new RedisOperationError({
          cause: new Error("Connection refused"),
          operation: "set",
          paywallId,
        })
      ),

    loadState: (paywallId) =>
      Effect.fail(
        new RedisOperationError({
          cause: new Error("Connection refused"),
          operation: "get",
          paywallId,
        })
      ),

    setCheckpoint: (paywallId) =>
      Effect.fail(
        new RedisOperationError({
          cause: new Error("Connection refused"),
          operation: "set",
          paywallId,
        })
      ),

    getCheckpoint: (paywallId) =>
      Effect.fail(
        new RedisOperationError({
          cause: new Error("Connection refused"),
          operation: "get",
          paywallId,
        })
      ),

    deleteState: (paywallId) =>
      Effect.fail(
        new RedisOperationError({
          cause: new Error("Connection refused"),
          operation: "delete",
          paywallId,
        })
      ),

    close: () => Effect.void,
  };

  return {
    mock,
    layer: Layer.succeed(RedisOperationsLogTag, mock),
  };
};

describe("redis-operations-log", () => {
  describe("saveState and loadState", () => {
    test("should save and load state", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          const state = { name: "Test Paywall", children: [] };
          yield* redis.saveState("paywall-1", state, 1);

          const loaded = yield* redis.loadState("paywall-1");
          expect(Option.isSome(loaded)).toBe(true);

          if (Option.isSome(loaded)) {
            expect(loaded.value.state).toEqual(state);
            expect(loaded.value.version).toBe(1);
            expect(loaded.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
            expect(typeof loaded.value.timestamp).toBe("number");
          }
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should return None for non-existent paywall", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          const loaded = yield* redis.loadState("non-existent");
          expect(Option.isNone(loaded)).toBe(true);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should overwrite existing state with new save", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          yield* redis.saveState("paywall-1", { name: "V1" }, 1);
          yield* redis.saveState("paywall-1", { name: "V2" }, 2);

          const loaded = yield* redis.loadState("paywall-1");
          expect(Option.isSome(loaded)).toBe(true);

          if (Option.isSome(loaded)) {
            expect(loaded.value.state).toEqual({ name: "V2" });
            expect(loaded.value.version).toBe(2);
          }
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("setCheckpoint and getCheckpoint", () => {
    test("should save and load checkpoint", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          yield* redis.setCheckpoint("paywall-1", "checkpoint-123");

          const checkpoint = yield* redis.getCheckpoint("paywall-1");
          expect(Option.isSome(checkpoint)).toBe(true);

          if (Option.isSome(checkpoint)) {
            expect(checkpoint.value).toBe("checkpoint-123");
          }
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should return None for non-existent checkpoint", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          const checkpoint = yield* redis.getCheckpoint("non-existent");
          expect(Option.isNone(checkpoint)).toBe(true);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("deleteState", () => {
    test("should delete state and checkpoint", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          // Set up state and checkpoint
          yield* redis.saveState("paywall-1", { name: "Test" }, 1);
          yield* redis.setCheckpoint("paywall-1", "checkpoint-1");

          // Verify they exist
          expect(Option.isSome(yield* redis.loadState("paywall-1"))).toBe(true);
          expect(Option.isSome(yield* redis.getCheckpoint("paywall-1"))).toBe(true);

          // Delete
          yield* redis.deleteState("paywall-1");

          // Verify they're gone
          expect(Option.isNone(yield* redis.loadState("paywall-1"))).toBe(true);
          expect(Option.isNone(yield* redis.getCheckpoint("paywall-1"))).toBe(true);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should be safe to delete non-existent paywall", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          // Should not throw
          yield* redis.deleteState("non-existent");
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("error handling", () => {
    test("should fail with RedisOperationError on save failure", async () => {
      const { layer } = createFailingMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;
          yield* redis.saveState("paywall-1", { name: "Test" }, 1);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe("Fail");
      }
    });

    test("should fail with RedisOperationError on load failure", async () => {
      const { layer } = createFailingMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;
          yield* redis.loadState("paywall-1");
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    test("RedisOperationError should contain operation and paywallId", async () => {
      const { layer } = createFailingMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;
          yield* redis.loadState("test-paywall-id");
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result) && result.cause._tag === "Fail") {
        const error = result.cause.error as RedisOperationError;
        expect(error._tag).toBe("RedisOperationError");
        expect(error.operation).toBe("get");
        expect(error.paywallId).toBe("test-paywall-id");
      }
    });
  });

  describe("multiple documents", () => {
    test("should handle multiple documents independently", async () => {
      const { layer } = createMockRedisOperationsLog();

      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const redis = yield* RedisOperationsLogTag;

          yield* redis.saveState("paywall-1", { name: "P1" }, 1);
          yield* redis.saveState("paywall-2", { name: "P2" }, 5);
          yield* redis.saveState("paywall-3", { name: "P3" }, 10);

          const p1 = yield* redis.loadState("paywall-1");
          const p2 = yield* redis.loadState("paywall-2");
          const p3 = yield* redis.loadState("paywall-3");

          expect(Option.isSome(p1) && p1.value.version).toBe(1);
          expect(Option.isSome(p2) && p2.value.version).toBe(5);
          expect(Option.isSome(p3) && p3.value.version).toBe(10);

          // Delete one shouldn't affect others
          yield* redis.deleteState("paywall-2");

          expect(Option.isSome(yield* redis.loadState("paywall-1"))).toBe(true);
          expect(Option.isNone(yield* redis.loadState("paywall-2"))).toBe(true);
          expect(Option.isSome(yield* redis.loadState("paywall-3"))).toBe(true);
        }).pipe(Effect.provide(layer))
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });
});
