import type { VoidhashClient } from "../../client";
import * as Console from "effect/Console";
import * as EffectRuntime from "effect/Effect";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";

/**
 * Lifecycle phase of the SDK client owned by `VoidhashProvider`.
 *
 * `"disabled"` is terminal: the client was created with `enabled: false`, so
 * no `init()` is ever attempted and `retryInit()` does nothing.
 */
export type VoidhashInitStatus = "disabled" | "failed" | "initializing" | "ready";

export interface VoidhashClientLifecycleState {
  /** The error that failed `init()`. `null` unless `status` is `"failed"`. */
  initError: Option.Option<VoidhashInitError>;
  status: VoidhashInitStatus;
}

export interface VoidhashClientLifecycleController {
  /** Current snapshot. Referentially stable until the state actually changes. */
  getState: () => VoidhashClientLifecycleState;
  /**
   * Starts an `init()` attempt and returns its teardown. Mirrors a React effect:
   * the teardown cancels pending state updates from that attempt and ends the
   * client, so a later `mount()` (remount / Fast Refresh) initializes cleanly.
   * Mounting a disabled client starts nothing and tears down nothing.
   */
  mount: () => () => void;
  /**
   * Re-runs `init()` after a failure. No-op while initializing, ready or
   * disabled.
   */
  retryInit: () => void;
  subscribe: (listener: () => void) => () => void;
}

interface InitAttempt {
  cancelled: boolean;
  initialized: boolean;
}

const INITIALIZING_STATE: VoidhashClientLifecycleState = {
  initError: Option.none(),
  status: "initializing",
};

const DISABLED_STATE: VoidhashClientLifecycleState = {
  initError: Option.none(),
  status: "disabled",
};

const noopTeardown = () => {
  return;
};

/** Normalizes an unknown rejection value into an `Error`. */
export class VoidhashInitError extends Schema.TaggedErrorClass<VoidhashInitError>(
  "VoidhashInitError",
)("VoidhashInitError", { message: Schema.String, cause: Schema.Unknown }) {}

export function toVoidhashInitError(value: unknown): VoidhashInitError {
  return new VoidhashInitError({
    message:
      P.isObject(value) && "message" in value && P.isString(value.message)
        ? value.message
        : String(value),
    cause: value,
  });
}

/**
 * Owns the `init()` / `end()` cycle of a {@link VoidhashClient} as a plain
 * external store, so `VoidhashProvider` reduces to a `useSyncExternalStore`
 * read plus a mount effect.
 *
 * `init()` and `end()` are serialized through a single promise queue. Without
 * it a mount → unmount → remount burst (Fast Refresh, React StrictMode, a test
 * remount) could run `end()` against a client whose next `init()` had already
 * started, leaking native listeners and timers.
 *
 * A disabled client (`enabled: false`) parks in the terminal `"disabled"`
 * state: mounting never calls `init()`, unmounting never calls `end()`.
 */
export function createVoidhashClientLifecycle(
  client: VoidhashClient,
): VoidhashClientLifecycleController {
  const listeners = MutableHashSet.empty<() => void>();
  let state: VoidhashClientLifecycleState = client.isEnabled ? INITIALIZING_STATE : DISABLED_STATE;
  let currentAttempt = Option.none<InitAttempt>();
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (task: () => Promise<void>): Promise<void> => {
    const next = queue.then(task).then(undefined, () => undefined);
    queue = next;
    return next;
  };

  const setState = (nextState: VoidhashClientLifecycleState) => {
    state = nextState;
    Array.from(listeners).forEach((listener) => listener());
  };

  const runInitAttempt = (attempt: InitAttempt) =>
    enqueue(async () => {
      const initError = await client.init().then(
        () => Option.none<VoidhashInitError>(),
        (error: unknown) => Option.some(toVoidhashInitError(error)),
      );

      attempt.initialized = Option.isNone(initError);
      if (attempt.cancelled) {
        return;
      }

      setState(
        Option.isSome(initError)
          ? { initError, status: "failed" }
          : { initError: Option.none(), status: "ready" },
      );
    });

  const endInitAttempt = (attempt: InitAttempt) =>
    enqueue(async () => {
      // `VoidhashClient.end()` dies when `init()` never completed, so an attempt
      // that failed outright has nothing to tear down. `init()` can also reject
      // *after* the client became usable — it wires the transaction observer and
      // the analytics queue before its last step — so the client's own flag is
      // consulted too, otherwise that partial initialization would leak native
      // listeners and timers.
      if (!(attempt.initialized || client.isInitialized)) {
        return;
      }

      attempt.initialized = false;
      await client.end().then(undefined, (error: unknown) => {
        // This warning is intentionally surfaced in all environments.
        EffectRuntime.runFork(
          Console.warn("[voidhash] failed to end the client on unmount", error),
        );
      });
    });

  const startAttempt = () => {
    const attempt: InitAttempt = { cancelled: false, initialized: false };
    currentAttempt = Option.some(attempt);
    void runInitAttempt(attempt);
  };

  return {
    getState: () => state,
    mount: () => {
      if (!client.isEnabled) {
        // Nothing was started, so the teardown has nothing to undo.
        return noopTeardown;
      }

      startAttempt();

      let unmounted = false;
      return () => {
        if (unmounted) {
          return;
        }
        unmounted = true;

        const attempt = currentAttempt;
        currentAttempt = Option.none();
        if (Option.isSome(attempt)) {
          attempt.value.cancelled = true;
          void endInitAttempt(attempt.value);
        }

        setState(INITIALIZING_STATE);
      };
    },
    retryInit: () => {
      // Gating on `failed` is what prevents a duplicate `init()` from being
      // fired while one is already in flight or has already succeeded.
      if (state.status !== "failed" || Option.isNone(currentAttempt)) {
        return;
      }

      // An `init()` that rejected after the client became usable leaves the
      // native store connection, the transaction observer and the AppState
      // subscription running, so the retry tears down through the same
      // serialized path as unmount before starting over — otherwise the second
      // `init()` would install a duplicate observer.
      const failedAttempt = currentAttempt.value;
      failedAttempt.cancelled = true;
      void endInitAttempt(failedAttempt);
      setState(INITIALIZING_STATE);
      startAttempt();
    },
    subscribe: (listener: () => void) => {
      MutableHashSet.add(listeners, listener);
      return () => {
        MutableHashSet.remove(listeners, listener);
      };
    },
  };
}
