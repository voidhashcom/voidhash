import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";

import { CacheManager } from "../caching/cache-manager";
import { Diagnostics } from "../diagnostics";
import { PlatformProvider } from "../platform/platform-provider";
import { JITTER_RATIO } from "./network-policy";

const FAILURE_THRESHOLD = 5;
export const INITIAL_OPEN_MS = 30_000;
export const MAX_OPEN_MS = 300_000;

/**
 * Storage key prefix of an open circuit. Every page of the site reads it when
 * it starts, so a page loaded during an outage does not spend a full set of
 * requests to learn that Voidhash is down; a multi-page site starts a new page
 * with every click. A circuit Voidhash's own failing answers opened stays open
 * for the rest of its cooldown. One that requests without an answer opened
 * admits a probe at once, since their cause may have been the visitor's own
 * connection, which may be back.
 */
const STORED_PREFIX = "network:circuit:";

interface BreakerState {
  consecutiveFailures: number;
  hasReportedOpen: boolean;
  /** Whether the open circuit is stored for the site's other pages. */
  isStored: boolean;
  openMs: number;
  openUntil: number;
  probeInFlight: boolean;
}

interface StoredCircuit {
  /** Whether failing answers opened it, rather than requests that got none. */
  readonly byAnswers?: boolean;
  readonly openMs: number;
  readonly openUntil: number;
}

const isStoredCircuit = (value: unknown): value is StoredCircuit =>
  P.hasProperty(value, "openMs") &&
  P.isNumber(value.openMs) &&
  P.hasProperty(value, "openUntil") &&
  P.isNumber(value.openUntil);

const initialState = (): BreakerState => ({
  consecutiveFailures: 0,
  hasReportedOpen: false,
  isStored: false,
  openMs: INITIAL_OPEN_MS,
  openUntil: 0,
  probeInFlight: false,
});

export const makeCircuitBreaker = Effect.fnUntraced(function* makeCircuitBreaker() {
  const cacheManager = yield* CacheManager;
  const diagnostics = yield* Diagnostics;
  const platform = yield* PlatformProvider;
  const states = new Map<string, BreakerState>();

  // Circuits another page of the site opened. One still open keeps this page
  // waiting; one whose cooldown ran out admits a single probe here. A circuit
  // that closed long ago says nothing about now and is forgotten, as is one
  // open for longer than any cooldown lasts, which a device clock moved back
  // leaves.
  const startedAt = yield* Clock.currentTimeMillis;
  const storedKeys = (yield* cacheManager.getCacheKeys()).filter((key) =>
    key.startsWith(STORED_PREFIX),
  );
  yield* Effect.forEach(
    storedKeys,
    (storedKey) =>
      Effect.gen(function* loadStoredCircuit() {
        const read = Option.map(yield* cacheManager.get<unknown>(storedKey), (hit) => hit.value);
        // Nothing this page may read yet, as before consent: another page's
        // circuit stays where it is.
        if (Option.isNone(read)) return;
        const stored = Option.filter(read, isStoredCircuit);
        if (
          Option.isNone(stored) ||
          startedAt - stored.value.openUntil > MAX_OPEN_MS ||
          stored.value.openUntil - startedAt > MAX_OPEN_MS * (1 + JITTER_RATIO)
        ) {
          yield* cacheManager.delete(storedKey);
          return;
        }
        states.set(storedKey.slice(STORED_PREFIX.length), {
          ...initialState(),
          consecutiveFailures: FAILURE_THRESHOLD,
          isStored: true,
          openMs: stored.value.openMs,
          // Half-open: the next request probes.
          openUntil: stored.value.byAnswers === true ? stored.value.openUntil : 1,
        });
      }),
    { concurrency: 1, discard: true },
  );

  const stateOf = (key: string) => {
    const existing = states.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created = initialState();
    states.set(key, created);
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

  /**
   * Closes the breaker after a successful round trip, and removes an open
   * circuit stored by this page or another, so pages loaded later do not wait
   * out its cooldown.
   */
  const recordSuccess = (key: string) =>
    Effect.gen(function* recordSuccess() {
      const storedKey = `${STORED_PREFIX}${key}`;
      const wasStored = states.get(key)?.isStored ?? false;
      states.set(key, initialState());
      if (wasStored || (yield* cacheManager.storedLength(storedKey)) > 0) {
        yield* cacheManager.delete(storedKey);
      }
    });

  /**
   * Counts a retryable failure and opens the breaker at the threshold.
   * `answered` says whether a failing answer came back, rather than none. A
   * request without an answer while the browser reports no network says
   * nothing about Voidhash and is not counted. The cooldown carries up to 25%
   * of random extra time, so the clients that saw an outage begin at the same
   * moment do not all probe Voidhash at the same moment either.
   */
  const recordFailure = (key: string, operation: string, answered: boolean) =>
    Effect.gen(function* recordFailure() {
      const state = stateOf(key);
      const wasProbing = state.probeInFlight;
      state.probeInFlight = false;
      if (!answered && !platform.isOnline()) return;
      state.consecutiveFailures += 1;

      if (!wasProbing && state.consecutiveFailures < FAILURE_THRESHOLD) {
        return;
      }

      const now = yield* Clock.currentTimeMillis;
      const jitter = yield* Random.next;
      state.openMs = wasProbing ? Math.min(state.openMs * 2, MAX_OPEN_MS) : state.openMs;
      state.openUntil = now + Math.round(state.openMs * (1 + JITTER_RATIO * jitter));
      state.hasReportedOpen = false;
      state.isStored = true;
      yield* cacheManager.set(`${STORED_PREFIX}${key}`, {
        byAnswers: answered,
        openMs: state.openMs,
        openUntil: state.openUntil,
      } satisfies StoredCircuit);
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
      const state = states.get(key);
      if (state !== undefined) {
        state.probeInFlight = false;
      }
    });

  /**
   * Moves every open breaker to half-open so the next request probes. Used on
   * connectivity restored and on the page becoming visible.
   */
  const halfOpenAll = () =>
    Effect.sync(() => {
      states.forEach((state) => {
        if (state.openUntil !== 0) {
          state.openUntil = 1;
          state.probeInFlight = false;
        }
      });
    });

  /** Whether requests against `key` have not failed since the last success. */
  const isHealthy = (key: string) => {
    const state = states.get(key);
    return state === undefined || (state.openUntil === 0 && state.consecutiveFailures === 0);
  };

  /** When an open breaker for `key` admits a probe again; none while it is closed. */
  const reopensAt = (key: string) =>
    Option.filter(Option.fromUndefinedOr(states.get(key)?.openUntil), (openUntil) => openUntil > 0);

  return {
    canAttempt,
    halfOpenAll,
    isHealthy,
    recordFailure,
    recordSuccess,
    releaseProbe,
    reopensAt,
  };
});

export class CircuitBreaker extends Context.Service<
  CircuitBreaker,
  Effect.Success<ReturnType<typeof makeCircuitBreaker>>
>()("web-voidhash/CircuitBreaker") {}
