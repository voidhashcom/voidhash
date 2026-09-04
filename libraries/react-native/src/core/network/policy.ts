import * as Arr from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

/** Per-attempt request budget. Hermes lacks `AbortSignal.timeout`, so the
 * timeout is applied with Effect's own scheduler instead. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Budget a cold read waits for its refresh. Strictly larger than
 * {@link REQUEST_TIMEOUT_MS} so the per-attempt timeout always fires first and
 * the failure reaches the circuit breaker instead of being cut off by the
 * read's own deadline.
 */
export const COLD_READ_BUDGET_MS = REQUEST_TIMEOUT_MS + 1_000;

/**
 * How long `identify()` waits for the pre-switch analytics flush. The flush
 * keeps running past this; it must not hold the identity switch hostage to
 * the network.
 */
export const IDENTIFY_FLUSH_BUDGET_MS = 2_000;

/** Backoff ceiling for queue delivery (analytics, transaction outbox). */
export const QUEUE_BACKOFF_CAP_MS = 30_000;

/** Backoff ceiling for configuration refreshes (schema, person, flags, paywalls). */
export const CONFIG_BACKOFF_CAP_MS = 60_000;

/**
 * How long an interactive read waits for an in-flight refresh before answering
 * from the stale cached value. The refresh keeps running in the background.
 */
export const FRESHNESS_BUDGET_MS = 500;

/** Statuses worth another attempt. Everything else is a verdict, not a fault. */
export const RETRYABLE_HTTP_STATUS_CODES = HashSet.fromIterable([408, 429, 500, 502, 503, 504]);

/** Statuses that mean the publishable key was rejected. */
export const AUTH_HTTP_STATUS_CODES = HashSet.fromIterable([401, 403]);

/** Whether a status code should be retried rather than treated as a verdict. */
export const isRetryableStatus = (status: number) =>
  HashSet.has(RETRYABLE_HTTP_STATUS_CODES, status);

/** Whether a status code means "credentials rejected". */
export const isAuthStatus = (status: number) => HashSet.has(AUTH_HTTP_STATUS_CODES, status);

/** Whether a response indicates host unavailability rather than a client verdict or throttle. */
export const countsTowardsBreaker = (status: number) =>
  status === 408 || status === 500 || status === 502 || status === 503 || status === 504;

/** Extracts an HTTP status from Effect HTTP errors and generated-client errors. */
export const httpStatusOf = (error: unknown): Option.Option<number> => {
  if (P.hasProperty(error, "status") && P.isNumber(error.status)) {
    return Option.some(error.status);
  }
  if (
    P.hasProperty(error, "response") &&
    P.hasProperty(error.response, "status") &&
    P.isNumber(error.response.status)
  ) {
    return Option.some(error.response.status);
  }
  return Option.none();
};

/**
 * Raised when a single request attempt exceeds {@link REQUEST_TIMEOUT_MS}.
 * Retryable — a timeout says nothing about whether the work would succeed.
 */
export class RequestTimeoutError extends Schema.TaggedErrorClass<RequestTimeoutError>()(
  "RequestTimeoutError",
  { operation: Schema.String },
) {}

/**
 * Applies the per-attempt timeout to one request. The failure is typed so
 * callers can treat it as retryable transport rather than an unknown defect.
 */
export const withRequestTimeout = <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Effect.Effect<A, E | RequestTimeoutError, R> =>
  Effect.timeoutOrElse(effect, {
    duration: Duration.millis(timeoutMs),
    orElse: () => Effect.fail(new RequestTimeoutError({ operation })),
  });

/**
 * Jittered exponential backoff: `min(cap, 1s · 2^(attempt-1))` plus up to 25 %
 * of that delay. `jitter` is the caller's random sample in `[0, 1)`, which
 * keeps the calculation pure and lets tests pin the result.
 */
export const computeBackoffMs = (attempt: number, capMs: number, jitter: number) => {
  const base = Math.min(capMs, 1000 * 2 ** Math.max(attempt - 1, 0));
  return Math.round(base + base * 0.25 * jitter);
};

/** {@link computeBackoffMs} with the jitter sampled from the Effect randomness. */
export const backoffMs = (attempt: number, capMs: number) =>
  Effect.map(Random.next, (jitter) => computeBackoffMs(attempt, capMs, jitter));

/**
 * Parses a `Retry-After` value: delta-seconds first, HTTP-date second.
 * Returns `None` for values that are neither.
 */
export const parseRetryAfterHeader = (value: string, now: number): Option.Option<number> => {
  const trimmed = value.trim();
  // `Number("")` is `0`, which would read as "retry immediately" — an empty or
  // whitespace-only header means the server said nothing.
  if (Str.isEmpty(trimmed)) return Option.none();

  const retryAfterSeconds = Number(trimmed);
  if (Number.isFinite(retryAfterSeconds)) {
    return retryAfterSeconds >= 0
      ? Option.some(Math.ceil(retryAfterSeconds * 1000))
      : Option.none();
  }
  // `Number("Infinity")` parses, but an unbounded cool-down is not a value
  // the server can meaningfully ask for.
  if (!Number.isNaN(retryAfterSeconds)) return Option.none();

  // Parsed with the platform clock, not `DateTime`: this beta's `DateTime`
  // shapes are still churning (`Option.filterMap` over a parsed date silently
  // drops every HTTP date), while `Date.parse` accepts both ISO instants and
  // IMF-fixdate HTTP dates on every runtime the SDK ships on.
  // oxlint-disable-next-line effect/use-clock-service -- parsing a server-sent timestamp, not reading the clock.
  const retryAt = Date.parse(trimmed);
  if (Number.isNaN(retryAt)) return Option.none();
  return Option.some(Math.max(retryAt - now, 0));
};

/**
 * Bounds a server-suggested cool-down by the caller's backoff cap. Values that
 * are not finite non-negative numbers are discarded so a malformed hint can
 * never park a queue forever.
 */
export const clampRetryAfterMs = (value: number, capMs: number): Option.Option<number> =>
  Number.isFinite(value) && value >= 0 ? Option.some(Math.min(value, capMs)) : Option.none();

/**
 * Resolves the server-suggested cool-down, header first and response body
 * second — the order the ingest and SDK APIs document. The answer is clamped
 * to `capMs`, the backoff ceiling of the queue that will honour it.
 */
export const resolveRetryAfterMs = (
  // oxlint-disable-next-line effect/prefer-option-over-null -- raw HTTP header bag from the generated client; a missing header is literally `undefined` there.
  headers: Readonly<Record<string, string | undefined>>,
  bodyRetryAfterMs: Option.Option<number>,
  now: number,
  capMs: number = QUEUE_BACKOFF_CAP_MS,
): Option.Option<number> => {
  // Header names are case-insensitive on the wire and the runtime that
  // produced this bag may not have normalized them.
  const headerEntry = Arr.findFirst(
    R.toEntries(headers),
    ([name]) => name.toLowerCase() === "retry-after",
  );
  const headerDelay = Option.flatMap(
    Option.flatMap(headerEntry, ([, value]) => Option.fromNullishOr(value)),
    (value) => parseRetryAfterHeader(value, now),
  );
  return Option.flatMap(
    Option.orElse(headerDelay, () => bodyRetryAfterMs),
    (delay) => clampRetryAfterMs(delay, capMs),
  );
};
