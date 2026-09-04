import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";

/** Per-attempt request timeout. Every network call is bounded by this. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Backoff ceiling for queue delivery retries. */
export const QUEUE_BACKOFF_CAP_MS = 30_000;

/** How long an interactive read waits for an in-flight refresh of a stale value. */
export const FRESHNESS_BUDGET_MS = 500;

const BACKOFF_BASE_MS = 1_000;
const JITTER_RATIO = 0.25;

/** HTTP statuses that are worth another attempt. */
export const RETRYABLE_STATUSES = HashSet.fromIterable([408, 429, 500, 502, 503, 504]);

const BREAKER_FAILURE_STATUSES = HashSet.fromIterable([408, 500, 502, 503, 504]);

/** Statuses that pause outbound traffic instead of retrying or dropping. */
export const AUTH_STATUSES = HashSet.fromIterable([401, 403]);

/** `true` when the status should be retried with backoff. */
export const isRetryableStatus = (status: number) => HashSet.has(RETRYABLE_STATUSES, status);

/** `true` when the status means the credentials are wrong, not the network. */
export const isAuthStatus = (status: number) => HashSet.has(AUTH_STATUSES, status);

/**
 * `true` when the status must not count towards the circuit breaker. Auth,
 * rate limiting and every other 4xx describe the request, not the health of the
 * host.
 */
export const countsTowardsBreaker = (status: number) =>
  HashSet.has(BREAKER_FAILURE_STATUSES, status);

/**
 * Jittered exponential backoff: `min(cap, 1s · 2^(attempt - 1))` plus up to 25%
 * of that delay, so retries from many clients do not align. `jitter` is the
 * caller's random sample in `[0, 1)`, which keeps the calculation pure and lets
 * tests pin the result.
 */
export const computeBackoffMs = (attempt: number, capMs: number, jitter: number) => {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(attempt - 1, 0), capMs);
  return Math.round(base + base * JITTER_RATIO * jitter);
};

/** {@link computeBackoffMs} with the jitter sampled from the Effect randomness. */
export const backoffMs = (attempt: number, capMs = QUEUE_BACKOFF_CAP_MS) =>
  Effect.map(Random.next, (jitter) => computeBackoffMs(attempt, capMs, jitter));

/**
 * Parses a `Retry-After` value: delta-seconds first, HTTP-date second. Returns
 * `None` for values that are neither.
 */
export const parseRetryAfterHeader = (value: string, now: number): Option.Option<number> => {
  const trimmed = Str.trim(value);
  // `Number("")` is `0`, which would read as "retry immediately" — an empty or
  // whitespace-only header means the server said nothing.
  if (Str.isEmpty(trimmed)) return Option.none();

  const retryAfterSeconds = Number(trimmed);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Option.some(Math.ceil(retryAfterSeconds * 1_000));
  }

  // oxlint-disable-next-line effect/use-clock-service -- parsing a server timestamp, not reading the clock.
  const retryAt = Date.parse(trimmed);
  return Number.isNaN(retryAt) ? Option.none() : Option.some(Math.max(retryAt - now, 0));
};

/**
 * Resolves the delay a rate-limited or unavailable response asks for: the
 * `Retry-After` header first, the JSON body's `retry_after_ms` second.
 */
export const resolveRetryAfterMs = (
  // oxlint-disable-next-line effect/prefer-option-over-null -- raw HTTP header bag from the HTTP client; a missing header is literally `undefined` there.
  headers: Readonly<Record<string, string | undefined>>,
  bodyRetryAfterMs: Option.Option<number>,
  now: number,
  capMs = QUEUE_BACKOFF_CAP_MS,
): Option.Option<number> => {
  // Header names are case-insensitive on the wire and the client that produced
  // this bag may not have normalized them.
  const headerEntry = Arr.findFirst(
    R.toEntries(headers),
    ([name]) => Str.toLowerCase(name) === "retry-after",
  );
  const headerDelay = Option.flatMap(
    Option.flatMap(headerEntry, ([, value]) => Option.fromNullishOr(value)),
    (value) => parseRetryAfterHeader(value, now),
  );
  return Option.flatMap(
    Option.orElse(headerDelay, () => bodyRetryAfterMs),
    (delay) =>
      Number.isFinite(delay) && delay >= 0 ? Option.some(Math.min(delay, capMs)) : Option.none(),
  );
};

/** Extracts the origin of a URL, ignoring path and query. */
export const originOf = (url: string) =>
  Result.try({
    try: () => new URL(url).origin,
    catch: () => url,
  }).pipe(Result.getOrElse(() => url));

/** Traffic planes that fail independently and get their own circuit breaker. */
export type NetworkPlane = "api" | "ingest";

/**
 * Circuit breaker key. The api and ingest planes are separate deployments, so
 * an outage on one must not stop traffic to the other even when both are served
 * from the same origin.
 */
export const breakerKey = (plane: NetworkPlane, url: string) => `${plane}:${originOf(url)}`;
