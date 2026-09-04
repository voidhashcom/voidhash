import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";

import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { REQUEST_TIMEOUT_MS } from "./policy";

/** Consecutive retryable failures that trip a host's breaker. */
export const BREAKER_FAILURE_THRESHOLD = 5;

/** First cool-down before a half-open probe is allowed through. */
export const BREAKER_INITIAL_COOLDOWN_MS = 30_000;

/** Ceiling the cool-down doubles up to while the host keeps failing. */
export const BREAKER_MAX_COOLDOWN_MS = 5 * 60_000;

/** Minimum gap between two foreground/connectivity-driven half-opens. */
export const BREAKER_HALF_OPEN_DEBOUNCE_MS = 60_000;

/**
 * Traffic planes tracked separately. Configuration reads and analytics ingest
 * are different services behind the same origin in the default setup, so an
 * ingest outage must not stop the SDK from refreshing entitlements.
 */
export type BreakerPlane = "config" | "ingest";

/** Key a breaker is tracked under: one entry per plane and host. */
export const breakerKey = (plane: BreakerPlane, host: string) => `${plane}:${host}`;

interface BreakerState {
  readonly consecutiveFailures: number;
  readonly cooldownMs: number;
  /** Epoch millis before which requests are skipped; `None` while closed. */
  readonly openUntil: Option.Option<number>;
  /** When the single half-open probe started; `None` when no probe is running. */
  readonly probeStartedAt: Option.Option<number>;
  /** Whether the open state has already produced its diagnostic. */
  readonly reported: boolean;
}

const closedState: BreakerState = {
  consecutiveFailures: 0,
  cooldownMs: BREAKER_INITIAL_COOLDOWN_MS,
  openUntil: Option.none(),
  probeStartedAt: Option.none(),
  reported: false,
};

const make = Effect.fn("makeCircuitBreaker")(function* effect() {
  const diagnostics = yield* Diagnostics;
  const states = MutableHashMap.empty<string, BreakerState>();
  const lastHalfOpenAt = MutableRef.make(Option.none<number>());

  const stateFor = (key: string) =>
    Option.getOrElse(MutableHashMap.get(states, key), () => closedState);

  /**
   * Whether a request to `key` may go out.
   *
   * An open breaker whose cool-down has elapsed admits exactly one probe: the
   * caller that claims the probe slot proceeds, everyone else is turned away
   * until that probe reports back. A probe that never reports — its fiber was
   * interrupted, say — releases the slot once it has outlived the per-attempt
   * request budget, so the breaker can never freeze half-open.
   */
  const canAttempt = Effect.fn("CircuitBreaker.canAttempt")(function* (
    key: string,
    operation: string,
  ) {
    const state = stateFor(key);
    if (Option.isNone(state.openUntil)) return true;

    const now = yield* Clock.currentTimeMillis;
    const probeExpired = Option.exists(
      state.probeStartedAt,
      (startedAt) => now - startedAt >= REQUEST_TIMEOUT_MS,
    );
    const probeSlotTaken = Option.isSome(state.probeStartedAt) && !probeExpired;

    if (state.openUntil.value > now || probeSlotTaken) {
      if (!state.reported) {
        MutableHashMap.set(states, key, { ...state, reported: true });
        yield* diagnostics.emit({
          code: DIAGNOSTIC_CODES.CIRCUIT_OPEN,
          kind: "breaker",
          message: `Skipping requests to ${key} while the circuit is open`,
          operation,
          retryable: true,
        });
      }
      return false;
    }

    MutableHashMap.set(states, key, { ...state, probeStartedAt: Option.some(now) });
    return true;
  });

  const recordSuccess = (key: string) =>
    Effect.sync(() => {
      MutableHashMap.set(states, key, closedState);
    });

  /**
   * Records one retryable failure and releases the probe slot. Authentication
   * and other 4xx verdicts must not reach this — a rejected key is not an
   * unreachable host.
   */
  const recordFailure = Effect.fn("CircuitBreaker.recordFailure")(function* (key: string) {
    const state = stateFor(key);
    const consecutiveFailures = state.consecutiveFailures + 1;
    if (consecutiveFailures < BREAKER_FAILURE_THRESHOLD) {
      MutableHashMap.set(states, key, {
        ...state,
        consecutiveFailures,
        probeStartedAt: Option.none(),
      });
      return;
    }

    const now = yield* Clock.currentTimeMillis;
    // The first trip uses the base cool-down; every re-open after a failed
    // probe doubles it, up to the ceiling.
    const hadTripped =
      Option.isSome(state.openUntil) || state.consecutiveFailures >= BREAKER_FAILURE_THRESHOLD;
    const cooldownMs = hadTripped
      ? Math.min(state.cooldownMs * 2, BREAKER_MAX_COOLDOWN_MS)
      : state.cooldownMs;
    MutableHashMap.set(states, key, {
      consecutiveFailures,
      cooldownMs,
      openUntil: Option.some(now + cooldownMs),
      probeStartedAt: Option.none(),
      reported: false,
    });
  });

  /** Releases a half-open probe without changing the host's failure history. */
  const releaseProbe = (key: string) =>
    Effect.sync(() => {
      const state = stateFor(key);
      if (Option.isSome(state.probeStartedAt)) {
        MutableHashMap.set(states, key, { ...state, probeStartedAt: Option.none() });
      }
    });

  /**
   * Lets the next request through on hosts that are still inside their
   * cool-down, without resetting the escalated window. Used on app foreground
   * and connectivity restore, where the reason a host was unreachable has
   * plausibly gone away — debounced so that a user flipping between apps
   * cannot defeat the backoff by half-opening on every transition.
   */
  const halfOpenAll = Effect.fn("CircuitBreaker.halfOpenAll")(function* () {
    const now = yield* Clock.currentTimeMillis;
    const last = MutableRef.get(lastHalfOpenAt);
    if (Option.exists(last, (at) => now - at < BREAKER_HALF_OPEN_DEBOUNCE_MS)) return false;
    MutableRef.set(lastHalfOpenAt, Option.some(now));

    Arr.forEach(Array.from(states), ([key, state]) => {
      if (Option.exists(state.openUntil, (until) => until > now)) {
        MutableHashMap.set(states, key, { ...state, openUntil: Option.some(now) });
      }
    });
    return true;
  });

  const isOpen = (key: string) => Option.isSome(stateFor(key).openUntil);

  return { canAttempt, halfOpenAll, isOpen, recordFailure, recordSuccess, releaseProbe } as const;
});

/**
 * Per-host, per-plane failure gate. Five consecutive retryable failures open a
 * host for 30 s; each failed half-open probe doubles the window up to five
 * minutes. While a host is open the SDK serves cache and skips the network
 * entirely, which keeps an outage from costing a request per read.
 */
export class CircuitBreaker extends Context.Service<
  CircuitBreaker,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/CircuitBreaker") {
  static readonly layer = Layer.effect(CircuitBreaker, make());
}
