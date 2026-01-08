/**
 * Unit tests for debounce-manager
 */

import { Effect, Exit, Fiber, TestClock, TestContext } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  DebounceManagerTag,
  layer as debounceLayer,
  type FlushFn,
} from "../debounce-manager";

/** Test runner that provides DebounceManager */
const runTest = <A, E>(
  effect: Effect.Effect<A, E, DebounceManagerTag>
): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(
    effect.pipe(Effect.provide(debounceLayer), Effect.provide(TestContext.TestContext))
  );

describe("debounce-manager", () => {
  describe("scheduleFlush", () => {
    test("should schedule a flush that executes after debounce delay", async () => {
      const flushCalls: Array<{ paywallId: string; state: unknown; version: number }> = [];
      const mockFlush: FlushFn = (paywallId, state, version) => {
        flushCalls.push({ paywallId, state, version });
        return Effect.void;
      };

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Schedule a flush
          yield* manager.scheduleFlush("paywall-1", { name: "Test" }, 1, mockFlush);

          // Verify it's pending
          const hasPending = yield* manager.hasPending("paywall-1");
          expect(hasPending).toBe(true);

          // Advance time past debounce delay (2 seconds)
          yield* TestClock.adjust("3 seconds");

          // Give the fiber time to execute
          yield* Effect.sleep(0);

          // Verify flush was called
          expect(flushCalls).toHaveLength(1);
          expect(flushCalls[0]).toEqual({
            paywallId: "paywall-1",
            state: { name: "Test" },
            version: 1,
          });

          // Verify no longer pending
          const stillPending = yield* manager.hasPending("paywall-1");
          expect(stillPending).toBe(false);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should cancel previous flush when scheduling new one", async () => {
      const flushCalls: Array<{ paywallId: string; version: number }> = [];
      const mockFlush: FlushFn = (paywallId, _state, version) => {
        flushCalls.push({ paywallId, version });
        return Effect.void;
      };

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Schedule first flush
          yield* manager.scheduleFlush("paywall-1", { name: "First" }, 1, mockFlush);

          // Wait 1 second (less than debounce delay)
          yield* TestClock.adjust("1 second");

          // Schedule second flush (should cancel first)
          yield* manager.scheduleFlush("paywall-1", { name: "Second" }, 2, mockFlush);

          // Wait past debounce delay
          yield* TestClock.adjust("3 seconds");
          yield* Effect.sleep(0);

          // Only second flush should have been called
          expect(flushCalls).toHaveLength(1);
          expect(flushCalls[0]).toEqual({
            paywallId: "paywall-1",
            version: 2,
          });
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should handle multiple documents independently", async () => {
      const flushCalls: Array<{ paywallId: string; version: number }> = [];
      const mockFlush: FlushFn = (paywallId, _state, version) => {
        flushCalls.push({ paywallId, version });
        return Effect.void;
      };

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Schedule flushes for two different documents
          yield* manager.scheduleFlush("paywall-1", { name: "P1" }, 1, mockFlush);
          yield* manager.scheduleFlush("paywall-2", { name: "P2" }, 1, mockFlush);

          // Verify both are pending
          expect(yield* manager.pendingCount()).toBe(2);

          // Wait past debounce delay
          yield* TestClock.adjust("3 seconds");
          yield* Effect.sleep(0);

          // Both should have been flushed
          expect(flushCalls).toHaveLength(2);
          expect(flushCalls.map((c) => c.paywallId).sort()).toEqual(["paywall-1", "paywall-2"]);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("cancel", () => {
    test("should cancel pending flush", async () => {
      const flushCalls: string[] = [];
      const mockFlush: FlushFn = (paywallId) => {
        flushCalls.push(paywallId);
        return Effect.void;
      };

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Schedule a flush
          yield* manager.scheduleFlush("paywall-1", { name: "Test" }, 1, mockFlush);

          // Cancel it
          yield* manager.cancel("paywall-1");

          // Verify not pending
          expect(yield* manager.hasPending("paywall-1")).toBe(false);

          // Wait past debounce delay
          yield* TestClock.adjust("3 seconds");
          yield* Effect.sleep(0);

          // Flush should not have been called
          expect(flushCalls).toHaveLength(0);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should be safe to cancel non-existent flush", async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Cancel a flush that doesn't exist (should not throw)
          yield* manager.cancel("non-existent");

          expect(yield* manager.pendingCount()).toBe(0);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("flushAll", () => {
    test("should flush all pending documents immediately", async () => {
      const flushCalls: Array<{ paywallId: string; version: number }> = [];
      const mockFlush: FlushFn = (paywallId, _state, version) => {
        flushCalls.push({ paywallId, version });
        return Effect.void;
      };

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Schedule multiple flushes
          yield* manager.scheduleFlush("paywall-1", {}, 1, mockFlush);
          yield* manager.scheduleFlush("paywall-2", {}, 2, mockFlush);
          yield* manager.scheduleFlush("paywall-3", {}, 3, mockFlush);

          expect(yield* manager.pendingCount()).toBe(3);

          // Flush all immediately (without waiting for debounce)
          yield* manager.flushAll(mockFlush);

          // All should be flushed
          expect(flushCalls).toHaveLength(3);
          expect(yield* manager.pendingCount()).toBe(0);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });

    test("should handle empty pending list", async () => {
      const flushCalls: string[] = [];
      const mockFlush: FlushFn = (paywallId) => {
        flushCalls.push(paywallId);
        return Effect.void;
      };

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Flush with nothing pending
          yield* manager.flushAll(mockFlush);

          expect(flushCalls).toHaveLength(0);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("pendingCount", () => {
    test("should return correct count", async () => {
      const mockFlush: FlushFn = () => Effect.void;

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          expect(yield* manager.pendingCount()).toBe(0);

          yield* manager.scheduleFlush("p1", {}, 1, mockFlush);
          expect(yield* manager.pendingCount()).toBe(1);

          yield* manager.scheduleFlush("p2", {}, 1, mockFlush);
          expect(yield* manager.pendingCount()).toBe(2);

          yield* manager.cancel("p1");
          expect(yield* manager.pendingCount()).toBe(1);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("hasPending", () => {
    test("should return true for pending documents", async () => {
      const mockFlush: FlushFn = () => Effect.void;

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          expect(yield* manager.hasPending("p1")).toBe(false);

          yield* manager.scheduleFlush("p1", {}, 1, mockFlush);
          expect(yield* manager.hasPending("p1")).toBe(true);
          expect(yield* manager.hasPending("p2")).toBe(false);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });

  describe("error handling", () => {
    test("should continue after flush error", async () => {
      const successCalls: string[] = [];
      const mockFlush: FlushFn = (paywallId) => {
        if (paywallId === "failing") {
          return Effect.fail(new Error("Flush failed"));
        }
        successCalls.push(paywallId);
        return Effect.void;
      };

      const result = await runTest(
        Effect.gen(function* () {
          const manager = yield* DebounceManagerTag;

          // Schedule a failing flush
          yield* manager.scheduleFlush("failing", {}, 1, mockFlush);

          // Wait past debounce delay
          yield* TestClock.adjust("3 seconds");
          yield* Effect.sleep(0);

          // Error should be logged but not propagate
          expect(yield* manager.pendingCount()).toBe(0);
        })
      );

      expect(Exit.isSuccess(result)).toBe(true);
    });
  });
});
