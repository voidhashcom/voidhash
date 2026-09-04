import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";

import { Diagnostics } from "../diagnostics";

const FAILURE_THRESHOLD = 5;
const INITIAL_OPEN_MS = 30_000;
const MAX_OPEN_MS = 300_000;

interface BreakerState {
  consecutiveFailures: number;
  hasReportedOpen: boolean;
  openMs: number;
  openUntil: number;
  probeInFlight: boolean;
}

const initialState = (): BreakerState => ({
  consecutiveFailures: 0,
  hasReportedOpen: false,
  openMs: INITIAL_OPEN_MS,
  openUntil: 0,
  probeInFlight: false,
});

const make = Effect.fn("makeCircuitBreaker")(function* effect() {
  const diagnostics = yield* Diagnostics;
  const states = MutableHashMap.empty<string, BreakerState>();

  const stateOf = (key: string) => {
    const existing = MutableHashMap.get(states, key);
    if (Option.isSome(existing)) {
      return existing.value;
    }
    const created = initialState();
    MutableHashMap.set(states, key, created);
    return created;
  };

  /**
   * Whether a request against `key` may go out. An open breaker admits a single
   * probe once its cooldown elapsed and refuses everything else. Every `true`
   * result must be paired with `recordSuccess`, `recordFailure` or
   * `releaseProbe` so the probe slot is not leaked.
   */
  const canAttempt = (key: string, operation: string) =>
    Effect.gen(function* canAttempt() {
      const state = stateOf(key);
      if (state.openUntil === 0) {
        return true;
      }

      const now = yield* Clock.currentTimeMillis;
      if (now < state.openUntil) {
        if (!state.hasReportedOpen) {
          state.hasReportedOpen = true;
          yield* diagnostics.report({
            code: "CIRCUIT_OPEN",
            kind: "breaker",
            message: `Skipping ${operation}; the circuit for ${key} is open.`,
            operation,
            retryable: true,
          });
        }
        return false;
      }

      if (state.probeInFlight) {
        return false;
      }

      state.probeInFlight = true;
      return true;
    });

  /** Closes the breaker after a successful round trip. */
  const recordSuccess = (key: string) =>
    Effect.sync(() => {
      MutableHashMap.set(states, key, initialState());
    });

  /** Counts a retryable transport failure and opens the breaker at the threshold. */
  const recordFailure = (key: string, operation: string) =>
    Effect.gen(function* recordFailure() {
      const state = stateOf(key);
      const wasProbing = state.probeInFlight;
      state.probeInFlight = false;
      state.consecutiveFailures += 1;

      if (!wasProbing && state.consecutiveFailures < FAILURE_THRESHOLD) {
        return;
      }

      const now = yield* Clock.currentTimeMillis;
      state.openMs = wasProbing ? Math.min(state.openMs * 2, MAX_OPEN_MS) : state.openMs;
      state.openUntil = now + state.openMs;
      state.hasReportedOpen = false;
      yield* diagnostics.report({
        code: "CIRCUIT_OPENED",
        kind: "breaker",
        message: `Circuit for ${key} opened for ${state.openMs}ms.`,
        operation,
        retryable: true,
      });
    });

  /**
   * Frees the probe slot for an attempt that ended without a verdict, for
   * example one abandoned after an authentication pause. Without this the half
   * open state would never admit another probe.
   */
  const releaseProbe = (key: string) =>
    Effect.sync(() => {
      Option.map(MutableHashMap.get(states, key), (state) => {
        state.probeInFlight = false;
      });
    });

  /**
   * Moves every open breaker to half-open so the next request probes. Used on
   * connectivity restored and on the page becoming visible.
   */
  const halfOpenAll = () =>
    Effect.sync(() => {
      MutableHashMap.forEach(states, (state) => {
        if (state.openUntil !== 0) {
          state.openUntil = 1;
          state.probeInFlight = false;
        }
      });
    });

  return { canAttempt, halfOpenAll, recordFailure, recordSuccess, releaseProbe };
});

export class CircuitBreaker extends Context.Service<
  CircuitBreaker,
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/CircuitBreaker") {
  static Default = Layer.effect(CircuitBreaker, make());
}
