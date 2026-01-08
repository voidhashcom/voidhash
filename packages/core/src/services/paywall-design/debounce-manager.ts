/**
 * Debounce Manager
 *
 * Manages per-document debouncing for MySQL saves.
 * Ensures saves are batched while guaranteeing a maximum delay.
 */

import { Context, Effect, Fiber, HashMap, Layer, Ref } from "effect";

/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 2000;

/** Maximum delay before forcing a flush (milliseconds) */
const MAX_DELAY_MS = 30000;

/**
 * Pending flush entry for a document
 */
interface PendingFlush {
  /** Fiber running the delayed flush */
  readonly fiber: Fiber.RuntimeFiber<void, unknown>;
  /** State to be flushed */
  readonly state: unknown;
  /** Version of the state */
  readonly version: number;
  /** Timestamp when first change was recorded (for max delay) */
  readonly firstChangeAt: number;
}

/**
 * Flush function type
 */
export type FlushFn = (
  paywallId: string,
  state: unknown,
  version: number
) => Effect.Effect<void, unknown>;

/**
 * Debounce Manager service interface
 */
export interface DebounceManager {
  /**
   * Schedule a debounced flush for a document.
   * Cancels any existing pending flush and starts a new one.
   * If max delay is exceeded, flushes immediately.
   */
  readonly scheduleFlush: (
    paywallId: string,
    state: unknown,
    version: number,
    flushFn: FlushFn
  ) => Effect.Effect<void>;

  /**
   * Force flush all pending documents (for graceful shutdown)
   */
  readonly flushAll: (flushFn: FlushFn) => Effect.Effect<void>;

  /**
   * Cancel any pending flush for a document
   */
  readonly cancel: (paywallId: string) => Effect.Effect<void>;

  /**
   * Check if a document has a pending flush
   */
  readonly hasPending: (paywallId: string) => Effect.Effect<boolean>;

  /**
   * Get count of pending flushes
   */
  readonly pendingCount: () => Effect.Effect<number>;
}

/**
 * Context tag for DebounceManager
 */
export class DebounceManagerTag extends Context.Tag(
  "PaywallDesign/DebounceManager"
)<DebounceManagerTag, DebounceManager>() {}

/**
 * Create DebounceManager implementation
 */
const makeDebounceManager = Effect.gen(function* () {
  // Map of paywallId -> PendingFlush
  const pending = yield* Ref.make(HashMap.empty<string, PendingFlush>());

  const manager: DebounceManager = {
    scheduleFlush: (
      paywallId: string,
      state: unknown,
      version: number,
      flushFn: FlushFn
    ) =>
      Effect.gen(function* () {
        const current = yield* Ref.get(pending);
        const existing = HashMap.get(current, paywallId);
        const now = Date.now();

        // Cancel existing timer if any
        if (existing._tag === "Some") {
          yield* Fiber.interrupt(existing.value.fiber);

          // Check if max delay exceeded - flush immediately
          const elapsed = now - existing.value.firstChangeAt;
          if (elapsed >= MAX_DELAY_MS) {
            // Remove from pending
            yield* Ref.update(pending, HashMap.remove(paywallId));

            // Flush immediately with error handling
            yield* flushFn(paywallId, state, version).pipe(
              Effect.catchAll((error) =>
                Effect.logError(
                  `Debounce: Failed to flush paywall ${paywallId}`,
                  error
                )
              )
            );
            return;
          }
        }

        // Determine first change timestamp (keep existing if updating)
        const firstChangeAt =
          existing._tag === "Some" ? existing.value.firstChangeAt : now;

        // Create debounced flush fiber
        const fiber = yield* Effect.fork(
          Effect.gen(function* () {
            // Wait for debounce delay
            yield* Effect.sleep(DEBOUNCE_MS);

            // Remove from pending map
            yield* Ref.update(pending, HashMap.remove(paywallId));

            // Execute flush with error handling
            yield* flushFn(paywallId, state, version).pipe(
              Effect.catchAll((error) =>
                Effect.logError(
                  `Debounce: Failed to flush paywall ${paywallId}`,
                  error
                )
              )
            );
          })
        );

        // Store pending flush
        const entry: PendingFlush = {
          fiber,
          firstChangeAt,
          state,
          version,
        };

        yield* Ref.update(pending, HashMap.set(paywallId, entry));
      }),

    flushAll: (flushFn: FlushFn) =>
      Effect.gen(function* () {
        const current = yield* Ref.get(pending);

        // Get all entries and clear the map
        const entries = HashMap.toEntries(current);
        yield* Ref.set(pending, HashMap.empty());

        // Cancel all fibers and flush immediately
        yield* Effect.forEach(
          entries,
          ([paywallId, entry]) =>
            Effect.gen(function* () {
              yield* Fiber.interrupt(entry.fiber);
              yield* flushFn(paywallId, entry.state, entry.version).pipe(
                Effect.catchAll((error) =>
                  Effect.logError(
                    `Debounce: Failed to flush paywall ${paywallId} during flushAll`,
                    error
                  )
                )
              );
            }),
          { concurrency: "unbounded" }
        );
      }),

    cancel: (paywallId: string) =>
      Effect.gen(function* () {
        const current = yield* Ref.get(pending);
        const existing = HashMap.get(current, paywallId);

        if (existing._tag === "Some") {
          yield* Fiber.interrupt(existing.value.fiber);
          yield* Ref.update(pending, HashMap.remove(paywallId));
        }
      }),

    hasPending: (paywallId: string) =>
      Ref.get(pending).pipe(
        Effect.map((map) => HashMap.has(map, paywallId))
      ),

    pendingCount: () =>
      Ref.get(pending).pipe(Effect.map((map) => HashMap.size(map))),
  };

  return manager;
});

/**
 * Layer for DebounceManager
 */
export const layer: Layer.Layer<DebounceManagerTag> = Layer.effect(
  DebounceManagerTag,
  makeDebounceManager
);

/**
 * Default layer
 */
export const Default: Layer.Layer<DebounceManagerTag> = layer;
