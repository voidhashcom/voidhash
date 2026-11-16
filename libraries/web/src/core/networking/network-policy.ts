import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";

import { isJsonObject } from "../json";

/** Per-attempt request timeout. Every network call is bounded by this. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Backoff ceiling for queue delivery retries. */
export const QUEUE_BACKOFF_CAP_MS = 30_000;

/** How long an interactive read waits for an in-flight refresh of a stale value. */
export const FRESHNESS_BUDGET_MS = 500;

const BACKOFF_BASE_MS = 1_000;
/** Largest random share added to a delay, so many clients do not retry in step. */
export const JITTER_RATIO = 0.25;

/** Statuses that pause outbound traffic instead of retrying or dropping. */
export const AUTH_STATUSES: ReadonlySet<number> = new Set([401, 403]);

/**
 * `true` when the status is worth another attempt: a timeout, "too early", rate
 * limiting, and every 5xx. An outage reaches the browser as more than the
 * standard five statuses: a proxy or CDN in front of an unreachable origin
 * answers 520–530, and such an answer says nothing about the request.
 */
export const isRetryableStatus = (status: number) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

/** `true` when the status means the credentials are wrong, not the network. */
export const isAuthStatus = (status: number) => AUTH_STATUSES.has(status);

/**
 * Whether an error answer came from Voidhash itself: its API tags an error
 * with `_tag`, event capture with `code`. A proxy, a CDN, or a deploy missing a
 * route answers without them, so its 4xx says nothing about the request.
 */
export const isVoidhashError = (body: unknown, plane: NetworkPlane) =>
  isJsonObject(body) && P.isString(plane === "api" ? body._tag : body.code);

/**
 * `true` when Voidhash judged the request itself, so another attempt cannot
 * change the answer: a 4xx carrying Voidhash's own error, other than a
 * timeout, rate limiting, or an authentication failure. Only such an answer
 * may drop queued data; anything else keeps it for another attempt. The iOS
 * and Android SDKs apply the same rule.
 */
export const isRefusal = (status: number, body: unknown, plane: NetworkPlane) =>
  status >= 400 &&
  status < 500 &&
  !isRetryableStatus(status) &&
  !isAuthStatus(status) &&
  isVoidhashError(body, plane);

/**
 * `true` when the answer says the host is failing: a timeout, any 5xx, and a
 * 4xx that did not come from Voidhash, such as a proxy's 404 for a route it
 * lacks. Rate limiting, authentication failures and Voidhash's own refusals
 * describe the request, not the health of the host.
 */
export const countsTowardsBreaker = (status: number, body: unknown, plane: NetworkPlane) =>
  status === 408 ||
  status === 425 ||
  status >= 500 ||
  (status >= 400 &&
    status < 500 &&
    status !== 429 &&
    !isAuthStatus(status) &&
    !isVoidhashError(body, plane));

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
