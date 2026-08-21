import type { VoidhashClient } from "../../client";

/**
 * Lifecycle phase of the SDK client owned by `VoidhashProvider`.
 *
 * `"disabled"` is terminal: the client was created with `enabled: false`, so
 * no `init()` is ever attempted and `retryInit()` does nothing.
 */
export type VoidhashInitStatus = "disabled" | "failed" | "initializing" | "ready";

export interface VoidhashClientLifecycleState {
  /** The error that failed `init()`. `null` unless `status` is `"failed"`. */
  initError: Error | null;
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
  initError: null,
  status: "initializing",
};

const DISABLED_STATE: VoidhashClientLifecycleState = {
  initError: null,
  status: "disabled",
};

const noopTeardown = () => {
  return;
};

/** Normalizes an unknown rejection value into an `Error`. */
export function toVoidhashInitError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
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
  const listeners = new Set<() => void>();
  let state: VoidhashClientLifecycleState = client.isEnabled ? INITIALIZING_STATE : DISABLED_STATE;
  let currentAttempt: InitAttempt | null = null;
  // oxlint-disable-next-line effect/noNewPromise -- this is the React/promise boundary described above: `init()`/`end()` are promise-returning client methods driven by a `useSyncExternalStore` mount effect, so the serialization queue they chain onto has to be a promise. There is no Effect runtime or Scope on this path to hang an Effect.Semaphore off.
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (task: () => Promise<void>): Promise<void> => {
    const next = queue.then(task).then(undefined, () => undefined);
    queue = next;
    return next;
  };

  const setState = (nextState: VoidhashClientLifecycleState) => {
    state = nextState;
    for (const listener of listeners) {
      listener();
    }
  };

  const runInitAttempt = (attempt: InitAttempt) =>
    enqueue(async () => {
      const initError = await client.init().then(
        () => null,
        (error: unknown) => toVoidhashInitError(error),
      );

      attempt.initialized = initError === null;
      if (attempt.cancelled) {
        return;
      }

      setState(initError ? { initError, status: "failed" } : { initError: null, status: "ready" });
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
        console.warn("[voidhash] failed to end the client on unmount", error);
      });
    });

  const startAttempt = () => {
    const attempt: InitAttempt = { cancelled: false, initialized: false };
    currentAttempt = attempt;
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
        currentAttempt = null;
        if (attempt) {
          attempt.cancelled = true;
          void endInitAttempt(attempt);
        }

        setState(INITIALIZING_STATE);
      };
    },
    retryInit: () => {
      // Gating on `failed` is what prevents a duplicate `init()` from being
      // fired while one is already in flight or has already succeeded.
      if (state.status !== "failed" || !currentAttempt) {
        return;
      }

      // An `init()` that rejected after the client became usable leaves the
      // native store connection, the transaction observer and the AppState
      // subscription running, so the retry tears down through the same
      // serialized path as unmount before starting over — otherwise the second
      // `init()` would install a duplicate observer.
      const failedAttempt = currentAttempt;
      failedAttempt.cancelled = true;
      void endInitAttempt(failedAttempt);
      setState(INITIALIZING_STATE);
      startAttempt();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
