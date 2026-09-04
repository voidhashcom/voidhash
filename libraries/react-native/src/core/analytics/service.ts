import * as P from "effect/Predicate";
import { make as makeEventCaptureClient } from "@voidhash/generated-clients/event-capture";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import * as Context from "effect/Context";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { CacheManager } from "../caching/cache-manager";
import { type CacheReadFailed } from "../caching/cache-adapter";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { IdentityManager } from "../identity/identity-manager";
import { AuthGate } from "../network/auth-gate";
import { breakerKey, CircuitBreaker } from "../network/circuit-breaker";
import {
  backoffMs,
  clampRetryAfterMs,
  countsTowardsBreaker,
  isAuthStatus,
  QUEUE_BACKOFF_CAP_MS,
  RequestTimeoutError,
  resolveRetryAfterMs,
  withRequestTimeout,
} from "../network/policy";
import { SingleFlight } from "../network/single-flight";
import { SdkConfiguration } from "../sdk-configuration";
import { AUTOMATIC_EVENTS } from "./constants";
import { AnalyticsSessionManager } from "./session-manager";
import { AnalyticsIngestEvent, AnalyticsSendFailure, QueuedAnalyticsEvent } from "./types";
import {
  createQueuedAnalyticsEventUnsafe,
  getAnalyticsStandardizedProperties,
  mapQueuedAnalyticsEventToIngestEvent,
} from "./utils";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_FLUSH_INTERVAL_MS = 5000;

/**
 * Hard ceiling on retained events. Reached only after a very long outage; the
 * oldest events are evicted first so the queue keeps the most recent history.
 */
export const ANALYTICS_QUEUE_CAP = 1000;

/** Coalescing window for the persist-behind write. */
export const ANALYTICS_PERSIST_DEBOUNCE_MS = 250;

/** Pending-event count that forces the persist-behind write early. */
export const ANALYTICS_PERSIST_EVENT_THRESHOLD = 20;

/** Cache key of the persisted analytics queue. */
export const ANALYTICS_QUEUE_STORAGE_KEY = "analytics:queue";

/**
 * Status codes treated as retryable for raw HTTP failures that don't surface a
 * typed error from the generated event-capture client (e.g. 408, 502, 504).
 * 429/500/503 are also retryable but reach the catch handlers as their typed
 * counterparts and so don't go through the status-set fallback.
 */
const RETRYABLE_HTTP_STATUS_CODES = HashSet.fromIterable([408, 429, 500, 502, 503, 504]);
const ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY = "voidhash:analytics:last-seen-app-release";

interface AppReleaseInfo {
  readonly appBuild: string;
  readonly appVersion: string;
}

const toReleaseString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (P.isString(value)) return value;
  if (P.isNumber(value) || P.isBoolean(value) || P.isBigInt(value)) {
    return String(value);
  }
  return effectEncodeJson(value);
};

const finiteOrZero = (value: unknown) => (P.isNumber(value) && Number.isFinite(value) ? value : 0);

/**
 * Decodes one persisted event. Scheduling counters that are missing or
 * damaged on disk are reset to "due now" instead of dropping the event: an
 * `availableAt` of `NaN` would otherwise never compare as due and park the
 * event forever.
 */
export const decodeQueuedAnalyticsEvent = (
  value: unknown,
  fallbackDistinctId = "",
): Option.Option<QueuedAnalyticsEvent> =>
  P.hasProperty(value, "id") &&
  P.isString(value.id) &&
  P.hasProperty(value, "eventName") &&
  P.isString(value.eventName) &&
  P.hasProperty(value, "sessionId") &&
  P.isString(value.sessionId)
    ? Option.some({
        attempts: finiteOrZero(P.hasProperty(value, "attempts") ? value.attempts : undefined),
        availableAt: finiteOrZero(
          P.hasProperty(value, "availableAt") ? value.availableAt : undefined,
        ),
        distinctId:
          P.hasProperty(value, "distinctId") && P.isString(value.distinctId)
            ? value.distinctId
            : fallbackDistinctId,
        eventName: value.eventName,
        eventTimestamp:
          P.hasProperty(value, "eventTimestamp") && P.isString(value.eventTimestamp)
            ? value.eventTimestamp
            : // oxlint-disable-next-line effect/use-clock-service -- epoch fallback for a damaged timestamp, not a clock read.
              new Date(0).toISOString(),
        id: value.id,
        properties:
          P.hasProperty(value, "properties") && P.isObject(value.properties)
            ? value.properties
            : {},
        sessionId: value.sessionId,
      })
    : Option.none();

const decodeQueue = (
  value: unknown,
  fallbackDistinctId: string,
): ReadonlyArray<QueuedAnalyticsEvent> =>
  // `getSomes(map(...))`, not `filterMap`: this Effect release's
  // `Array.filterMap` keeps `Result`s, so an `Option` callback would drop
  // every event and a restart would come back empty.
  Array.isArray(value)
    ? Arr.getSomes(Arr.map(value, (event) => decodeQueuedAnalyticsEvent(event, fallbackDistinctId)))
    : [];

/** Events in queue order, in-flight batch first, each id once. */
const mergeUnique = (
  ...groups: ReadonlyArray<ReadonlyArray<QueuedAnalyticsEvent>>
): ReadonlyArray<QueuedAnalyticsEvent> => {
  let seen = HashSet.empty<string>();
  return groups.flat().filter((event) => {
    if (HashSet.has(seen, event.id)) return false;
    seen = HashSet.add(seen, event.id);
    return true;
  });
};

/**
 * Owns the analytics pipeline: a persistent, capped event queue with batching,
 * jittered backoff, `Retry-After` honouring, automatic startup events
 * (`$app_installed` / `$app_updated` / `$app_opened`), and a periodic flush
 * daemon forked into the service scope. Every event is stamped with the
 * session id from `AnalyticsSessionManager` as it enters the queue, so a
 * single batch may span two sessions. Disposing the runtime closes the scope,
 * which interrupts the daemon — no manual timer cleanup required.
 *
 * Events leave the queue only when ingest answers `202`, or when the server
 * returns a verdict that re-sending cannot change (400/404/409/422, and a
 * single event too large to accept). Transport failures — timeouts, 5xx, an
 * open circuit, a paused authentication gate — always keep the events.
 *
 * `capture` is fully synchronous: it stamps the event from in-memory state and
 * appends it, leaving the storage write to the persist-behind daemon. That is
 * what lets the React Native client capture on the calling thread over a
 * promise-backed storage adapter.
 */
const make = Effect.fn("makeAnalyticsService")(function* () {
  const identityManager = yield* IdentityManager;
  // Capture is synchronous after the service is built, so establish the
  // identity once while construction may still suspend on storage.
  yield* identityManager.getDistinctId();
  const cacheManager = yield* CacheManager;
  const sdkConfiguration = yield* SdkConfiguration;
  const sessionManager = yield* AnalyticsSessionManager;
  const httpClient = yield* HttpClient.HttpClient;
  const diagnostics = yield* Diagnostics;
  const breaker = yield* CircuitBreaker;
  const authGate = yield* AuthGate;
  const singleFlight = yield* SingleFlight;

  /**
   * Loads the persisted queue. `None` means the store could not be read,
   * which is not the same as an empty queue: a store we could not read
   * must not be overwritten with what little is held in memory.
   */
  const loadQueue = Effect.fn("AnalyticsService.loadQueue")(function* () {
    return yield* cacheManager.tryGet<ReadonlyArray<unknown>>(ANALYTICS_QUEUE_STORAGE_KEY).pipe(
      Effect.map((hit) =>
        Option.some(
          Option.match(hit, {
            onNone: () => Arr.empty<QueuedAnalyticsEvent>(),
            onSome: (entry) => decodeQueue(entry.value, identityManager.getDistinctIdUnsafe()),
          }),
        ),
      ),
      Effect.catch((failure: CacheReadFailed) =>
        Effect.as(
          diagnostics.emit({
            code: DIAGNOSTIC_CODES.CACHE_READ_FAILED,
            kind: "cache",
            message: `Could not read the persisted analytics queue: ${failure.message}`,
            operation: "capture",
            retryable: true,
          }),
          Option.none<ReadonlyArray<QueuedAnalyticsEvent>>(),
        ),
      ),
    );
  });

  const restored = yield* loadQueue();
  const queueRef = yield* Ref.make<ReadonlyArray<QueuedAnalyticsEvent>>(
    Option.getOrElse(restored, () => Arr.empty<QueuedAnalyticsEvent>()),
  );
  const restoreFailed = MutableRef.make(Option.isNone(restored));
  // The batch currently being sent. It has left `queueRef` but is still
  // owed to storage until the server acknowledges it.
  const inFlightRef = MutableRef.make<ReadonlyArray<QueuedAnalyticsEvent>>([]);
  const latch = yield* Latch.make(false);
  const persistLatch = yield* Latch.make(false);
  const persistNowLatch = yield* Latch.make(false);
  const pendingWrites = MutableRef.make(0);
  const persistMutex = yield* Semaphore.make(1);
  const serviceScope = yield* Effect.scope;
  const lastFlushError = MutableRef.make(Option.none<AnalyticsSendFailure>());
  const deliveredInFlush = MutableRef.make(0);
  const getStandardizedProperties = yield* Effect.cached(getAnalyticsStandardizedProperties);
  const flushCallbackRef = MutableRef.make(Option.none<() => void>());

  // The ingest endpoint lives on the same host as the API but under the
  // `/i/v1/...` path prefix. The generated client owns the path, so we
  // only need to inject the base origin via `prependUrl`. `ingestUrl`
  // remains as an override for local/test ingest servers.
  const ingestBaseUrl = sdkConfiguration.ingestUrl ?? sdkConfiguration.baseUrl;
  // Tracked on its own plane: ingest being down must not stop the SDK from
  // refreshing entitlements, even when both share an origin.
  const ingestBreakerKey = breakerKey("ingest", ingestBaseUrl);
  const eventCaptureClient = makeEventCaptureClient(httpClient, {
    transformClient: (client) =>
      Effect.succeed(
        client.pipe(
          HttpClient.mapRequest((request) => HttpClientRequest.prependUrl(request, ingestBaseUrl)),
          // The ingest acknowledgement contract is exact: another 2xx is
          // a healthy response, but it does not confirm delivery.
          HttpClient.filterStatus((status) => status === 202 || status < 200 || status >= 300),
        ),
      ),
  });

  /**
   * Writes the queue to storage, in-flight batch included, and only when
   * something changed since the last write.
   *
   * Every write goes through one permit and snapshots the queue *inside*
   * the critical section. Without that, two overlapping writes can land in
   * the opposite order and an older snapshot resurrects events that were
   * already delivered or postponed. The dirty counter is only reduced by
   * what this write actually covered, so mutations that arrived while the
   * adapter was busy still schedule the next write.
   *
   * While the boot-time load has failed, the write first retries the load
   * and merges what is on disk in front of the in-memory queue; until that
   * succeeds nothing is written, so a store that was briefly unreadable
   * never loses the events it already holds.
   */
  const persistQueue = Effect.fn("AnalyticsService.persistQueue")(
    function* () {
      const coveredWrites = MutableRef.get(pendingWrites);
      if (coveredWrites === 0) return;
      if (MutableRef.get(restoreFailed)) {
        const reloaded = yield* loadQueue();
        if (Option.isNone(reloaded)) return;
        MutableRef.set(restoreFailed, false);
        yield* Ref.update(queueRef, (queue) => mergeUnique(reloaded.value, queue));
      }
      const queue = yield* Ref.get(queueRef);
      const snapshot = mergeUnique(MutableRef.get(inFlightRef), queue);
      const persisted = yield* cacheManager.trySet(ANALYTICS_QUEUE_STORAGE_KEY, snapshot);
      if (persisted) {
        MutableRef.set(pendingWrites, Math.max(MutableRef.get(pendingWrites) - coveredWrites, 0));
      }
    },
    (effect) => persistMutex.withPermits(1)(effect),
  );

  /**
   * Records that the queue changed. The write itself is coalesced: at most
   * one every {@link ANALYTICS_PERSIST_DEBOUNCE_MS}, or immediately once
   * {@link ANALYTICS_PERSIST_EVENT_THRESHOLD} events are waiting. A hard
   * crash inside that window loses at most those events.
   */
  const markDirtyUnsafe = () => {
    MutableRef.set(pendingWrites, MutableRef.get(pendingWrites) + 1);
    persistLatch.openUnsafe();
    if (MutableRef.get(pendingWrites) >= ANALYTICS_PERSIST_EVENT_THRESHOLD) {
      persistNowLatch.openUnsafe();
    }
  };

  /**
   * Appends events, evicting the oldest once the cap is reached. Stays
   * synchronous end to end so `capture` can run on the calling thread.
   */
  const enqueue = Effect.fn("AnalyticsService.enqueue")(function* (
    events: ReadonlyArray<QueuedAnalyticsEvent>,
  ) {
    if (Arr.isReadonlyArrayEmpty(events)) return;
    const dropped = yield* Ref.modify(queueRef, (queue) => {
      const next = [...queue, ...events];
      const overflow = next.length - ANALYTICS_QUEUE_CAP;
      return overflow > 0
        ? ([next.slice(0, overflow), next.slice(overflow)] as const)
        : ([Arr.empty<QueuedAnalyticsEvent>(), next] as const);
    });
    Arr.forEach(dropped, (event) => {
      diagnostics.emitUnsafe({
        code: DIAGNOSTIC_CODES.ANALYTICS_EVENT_DROPPED,
        kind: "eviction",
        message: `Evicted "${event.eventName}" — the analytics queue reached its cap of ${ANALYTICS_QUEUE_CAP} events`,
        operation: "capture",
        retryable: false,
      });
    });
    markDirtyUnsafe();
  });

  const failNonRetryable = (status: number) =>
    Effect.fail(
      new AnalyticsSendFailure({
        message: `Analytics ingest request failed: ${status}`,
        retryable: false,
        status,
      }),
    );

  // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the optional `retryAfterMs` field on `AnalyticsSendFailure`, which the schema models as `undefined`.
  const failRetryable = (status: number, retryAfterMs?: number) =>
    Effect.fail(
      new AnalyticsSendFailure({
        message: `Analytics ingest request failed: ${status}`,
        retryAfterMs,
        retryable: true,
        status,
      }),
    );

  const failWithServerCooldown = (
    status: number,
    // oxlint-disable-next-line effect/prefer-option-over-null -- raw HTTP header bag from the generated client; a missing header is literally `undefined` there.
    headers: Readonly<Record<string, string | undefined>>,
    bodyRetryAfterMs: Option.Option<number>,
  ) =>
    Effect.fn("AnalyticsService.failWithServerCooldown")(function* () {
      const now = yield* Clock.currentTimeMillis;
      return yield* failRetryable(
        status,
        Option.getOrUndefined(resolveRetryAfterMs(headers, bodyRetryAfterMs, now)),
      );
    })();

  const sendAnalyticsEvents = Effect.fn("AnalyticsService.sendAnalyticsEvents")(
    function* (events: ReadonlyArray<AnalyticsIngestEvent>) {
      if (Arr.isReadonlyArrayEmpty(events)) return;

      const distinctId = yield* identityManager.getDistinctId();
      const sentAt = yield* DateTime.now;
      yield* withRequestTimeout(
        "eventCaptureBatch",
        eventCaptureClient.eventCaptureBatch({
          payload: {
            events: events.map((event) => ({
              context: event.context,
              distinct_id: event.distinct_id ?? distinctId,
              event: event.event_name,
              properties: event.properties,
              session_id: event.session_id,
              timestamp: event.event_ts,
              uuid: event.event_id,
            })),
            sent_at: DateTime.formatIso(sentAt),
            // A distributed client holds no secret key, so ingest authorizes
            // on the publishable token in the body.
            token: sdkConfiguration.publishableKey,
          },
        }),
      );
    },
    Effect.catchTags({
      CaptureDependencyUnavailableError: (err) =>
        failWithServerCooldown(err.response.status, err.response.headers, Option.none()),
      CaptureInternalServerError: (err) => failRetryable(err.response.status),
      // The 400 is now a typed contract error rather than an untagged
      // `EventCaptureBatch400`.
      CaptureInvalidRequestError: (err) => failNonRetryable(err.response.status),
      CapturePayloadTooLargeError: (err) => failNonRetryable(err.response.status),
      CaptureRateLimitedError: (err) =>
        failWithServerCooldown(
          err.response.status,
          err.response.headers,
          Option.fromNullishOr(err.data.retry_after_ms),
        ),
      CaptureUnauthorizedError: (err) => failNonRetryable(err.response.status),
      RequestTimeoutError: (err: RequestTimeoutError) =>
        Effect.fail(
          new AnalyticsSendFailure({
            cause: err,
            message: "Analytics request timed out",
            retryable: true,
          }),
        ),
    }),
    // Unmapped status codes (e.g. 408/502/504) surface as
    // `HttpClientError`; treat network errors and the retryable subset
    // as retryable, everything else as non-retryable.
    Effect.catchTag("HttpClientError", (cause) => {
      const status = cause.response?.status;
      if (status === undefined) {
        return Effect.fail(
          new AnalyticsSendFailure({
            cause,
            message: "Analytics request failed",
            retryable: true,
          }),
        );
      }
      return HashSet.has(RETRYABLE_HTTP_STATUS_CODES, status)
        ? failRetryable(status)
        : status >= 200 && status < 300
          ? failRetryable(status)
          : failNonRetryable(status);
    }),
  );

  /**
   * Puts a batch back at the head of the queue with a bumped
   * `availableAt`, so the next due-check skips it until the cool-down has
   * elapsed. Called once per drain step with the whole ordered remainder,
   * which is what keeps FIFO intact when a 413 splits a batch: the halves
   * are re-queued together, in their original order, instead of each
   * prepending itself and landing reversed.
   */
  const requeue = Effect.fn("AnalyticsService.requeue")(function* (
    events: ReadonlyArray<QueuedAnalyticsEvent>,
  ) {
    if (Arr.isReadonlyArrayEmpty(events)) return;
    yield* Ref.update(queueRef, (queue) => [...events, ...queue]);
    markDirtyUnsafe();
  });

  const postponedAt = Effect.fn("AnalyticsService.postponedAt")(function* (
    events: ReadonlyArray<QueuedAnalyticsEvent>,
    retryAfterMs: Option.Option<number>,
  ) {
    const now = yield* Clock.currentTimeMillis;
    const delayMs = yield* Option.match(
      Option.flatMap(retryAfterMs, (value) => clampRetryAfterMs(value, QUEUE_BACKOFF_CAP_MS)),
      {
        onNone: () => backoffMs((events[0]?.attempts ?? 0) + 1, QUEUE_BACKOFF_CAP_MS),
        onSome: (value) => Effect.succeed(value),
      },
    );
    return events.map((event) => ({
      ...event,
      attempts: event.attempts + 1,
      availableAt: now + delayMs,
    }));
  });

  // Pops the next `due` batch (events whose `availableAt <= now`) from the
  // head of the queue into `inFlightRef`. Treating taken events as "in
  // flight" simplifies failure handling: success means no further action,
  // everything else is handed back to the drain loop to re-queue in
  // order. The batch stays part of the persisted snapshot until then.
  const takeDueBatch = (now: number) =>
    Ref.modify(queueRef, (queue) => {
      const initial: {
        readonly batch: ReadonlyArray<QueuedAnalyticsEvent>;
        readonly stopped: boolean;
      } = { batch: [], stopped: false };
      const { batch } = Arr.reduce(queue, initial, (state, event) => {
        if (
          state.stopped ||
          event.availableAt > now ||
          state.batch.length >= ANALYTICS_BATCH_SIZE
        ) {
          return { ...state, stopped: true };
        }
        return { batch: [...state.batch, event], stopped: false };
      });
      MutableRef.set(inFlightRef, batch);
      return [batch, queue.slice(batch.length)];
    });

  /** Hands an in-flight remainder back to the queue head, then releases the batch. */
  const settleInFlight = Effect.fn("AnalyticsService.settleInFlight")(function* (
    remainder: ReadonlyArray<QueuedAnalyticsEvent>,
  ) {
    yield* requeue(remainder);
    MutableRef.set(inFlightRef, []);
  });

  /**
   * Attempts one batch and answers with the events that have to go back on
   * the queue, in their original order. An empty answer means the batch is
   * finished — delivered, or refused by a verdict re-sending cannot change.
   */
  const processQueuedBatch: (
    queuedBatch: ReadonlyArray<QueuedAnalyticsEvent>,
    standardizedProperties: Record<string, unknown>,
    authProbe?: boolean,
  ) => Effect.Effect<ReadonlyArray<QueuedAnalyticsEvent>> = Effect.fn(
    "AnalyticsService.processQueuedBatch",
  )(function* (
    queuedBatch: ReadonlyArray<QueuedAnalyticsEvent>,
    standardizedProperties: Record<string, unknown>,
    authProbe = false,
  ) {
    const ingestBatch = queuedBatch.map((event) =>
      mapQueuedAnalyticsEventToIngestEvent(event, standardizedProperties),
    );

    return yield* sendAnalyticsEvents(ingestBatch).pipe(
      Effect.tap(() =>
        Effect.fn("AnalyticsService.recordBatchSuccess")(function* () {
          if (authProbe) yield* authGate.completeProbe(true);
          yield* breaker.recordSuccess(ingestBreakerKey);
        })(),
      ),
      Effect.map(() => {
        MutableRef.set(deliveredInFlush, MutableRef.get(deliveredInFlush) + queuedBatch.length);
        markDirtyUnsafe();
        return Arr.empty<QueuedAnalyticsEvent>();
      }),
      Effect.catchTag("AnalyticsSendFailure", (failure) =>
        Effect.fn("AnalyticsService.handleSendFailure")(function* () {
          MutableRef.set(lastFlushError, Option.some(failure));
          if (authProbe) {
            yield* authGate.completeProbe(
              failure.status !== undefined && !isAuthStatus(failure.status),
            );
          }

          if (failure.status === 413 && queuedBatch.length > 1) {
            const midpoint = Math.ceil(queuedBatch.length / 2);
            const head = yield* processQueuedBatch(
              queuedBatch.slice(0, midpoint),
              standardizedProperties,
            );
            const tail = yield* processQueuedBatch(
              queuedBatch.slice(midpoint),
              standardizedProperties,
            );
            return [...head, ...tail];
          }

          if (failure.status !== undefined && isAuthStatus(failure.status)) {
            // A rejected key is not a delivery verdict: keep the events and
            // stop sending until the app supplies a working configuration.
            yield* breaker.releaseProbe(ingestBreakerKey);
            yield* authGate.pause("capture", failure.status);
            return yield* postponedAt(queuedBatch, Option.none());
          }

          if (failure.retryable) {
            if (failure.status === undefined || countsTowardsBreaker(failure.status)) {
              yield* breaker.recordFailure(ingestBreakerKey);
            } else {
              yield* breaker.releaseProbe(ingestBreakerKey);
            }
            yield* diagnostics.emit({
              code: DIAGNOSTIC_CODES.REQUEST_FAILED,
              httpStatus: failure.status,
              kind: "transport",
              message: failure.message,
              operation: "capture",
              retryable: true,
            });
            return yield* postponedAt(queuedBatch, Option.fromNullishOr(failure.retryAfterMs));
          }

          // A verdict is not a host failure: the half-open probe slot is
          // handed back so the next batch does not wait out the probe
          // budget before it may try.
          yield* breaker.releaseProbe(ingestBreakerKey);
          yield* diagnostics.emit({
            code: DIAGNOSTIC_CODES.ANALYTICS_EVENT_DROPPED,
            httpStatus: failure.status,
            kind: "eviction",
            message: `Dropped ${queuedBatch.length} analytics event(s) the server refused`,
            operation: "capture",
            retryable: false,
          });
          markDirtyUnsafe();
          return Arr.empty<QueuedAnalyticsEvent>();
        })(),
      ),
    );
  });

  const capture = Effect.fn("AnalyticsService.capture")(function* (
    eventName: string,
    properties: Record<string, unknown> = {},
  ) {
    const normalized = eventName.trim();
    if (!normalized) return;
    const now = yield* Clock.currentTimeMillis;
    const sessionId = sessionManager.touchUnsafe();
    const queued = createQueuedAnalyticsEventUnsafe(
      normalized,
      properties,
      sessionId,
      identityManager.getDistinctIdUnsafe(),
      now,
    );
    yield* enqueue([queued]);
    // Forked, never awaited: the capture path must stay synchronous, but
    // the session still has to survive a process restart. Forked into the
    // service scope so disposing the runtime stops it; `flush()` and
    // `end()` persist the session on their own path anyway.
    yield* Effect.forkIn(sessionManager.flushPersist(), serviceScope, {
      startImmediately: true,
    });
    if (Ref.getUnsafe(queueRef).length >= ANALYTICS_BATCH_SIZE) {
      // Wake the flush daemon rather than waiting for the tick. The
      // daemon runs the flush on its own fiber, so the capture path never
      // carries a storage write or a network round trip.
      latch.openUnsafe();
    }
  });

  const drainQueue = Effect.fn("AnalyticsService.drainQueue")(function* () {
    const standardizedProperties = yield* getStandardizedProperties;

    const drain: () => Effect.Effect<void> = Effect.fn("AnalyticsService.drainStep")(function* () {
      const now = yield* Clock.currentTimeMillis;
      const batch = yield* takeDueBatch(now);
      if (Arr.isReadonlyArrayEmpty(batch)) return;

      const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
      if (authGate.isPaused() && !authProbe) {
        yield* settleInFlight(batch);
        return;
      }
      const allowed = yield* breaker.canAttempt(ingestBreakerKey, "capture");
      if (!allowed) {
        if (authProbe) yield* authGate.completeProbe(false);
        yield* settleInFlight(batch);
        return;
      }

      const remainder = yield* processQueuedBatch(batch, standardizedProperties, authProbe).pipe(
        // An interrupted send (the runtime being disposed mid-flush)
        // must not lose the batch from memory: it goes back on the
        // queue as it was, and the persisted snapshot already holds it.
        Effect.onInterrupt(() => settleInFlight(batch)),
      );
      yield* settleInFlight(remainder);
      if (Arr.isReadonlyArrayNonEmpty(remainder)) {
        // Postponed: the whole ordered remainder went back and the
        // drain stops, so a failing host is not hammered once per
        // queued batch.
        return;
      }
      yield* drain();
    });
    yield* drain();
  });

  /**
   * Delivers everything currently due and reports how many events left the
   * queue and how many are still waiting. Single-flighted, so a foreground
   * burst and the flush daemon never send the same batch twice. The queue
   * is written to storage before the first attempt and after the drain,
   * each time only if it changed.
   */
  const flush = Effect.fn("AnalyticsService.flush")(function* () {
    return yield* singleFlight.run(
      "analytics:flush",
      Effect.fn("AnalyticsService.runFlush")(function* () {
        MutableRef.set(deliveredInFlush, 0);
        MutableRef.set(lastFlushError, Option.none());
        yield* sessionManager.flushPersist();
        yield* persistQueue();
        yield* drainQueue();
        yield* persistQueue();
        return {
          flushed: MutableRef.get(deliveredInFlush),
          lastError: MutableRef.get(lastFlushError),
          pending: Ref.getUnsafe(queueRef).length,
        };
      })(),
    );
  });

  const transferEvents = Effect.fn("AnalyticsService.transferEvents")(function* (
    events: ReadonlyArray<{
      eventName: string;
      properties: Record<string, unknown>;
    }>,
  ) {
    const pending = events.filter((event) => Str.isNonEmpty(event.eventName.trim()));
    if (Arr.isReadonlyArrayEmpty(pending)) return;
    // Buffered events are stamped at transfer time rather than at their
    // original capture: the session manager does not exist before init.
    const now = yield* Clock.currentTimeMillis;
    const sessionId = sessionManager.touchUnsafe();
    const distinctId = identityManager.getDistinctIdUnsafe();
    const additions = pending.map((event) =>
      createQueuedAnalyticsEventUnsafe(
        event.eventName.trim(),
        event.properties,
        sessionId,
        distinctId,
        now,
      ),
    );
    yield* enqueue(additions);
  });

  const captureAutomaticStartupEvents = Effect.fn("AnalyticsService.captureAutomaticStartupEvents")(
    function* () {
      const standardizedProps = yield* getStandardizedProperties;
      const currentAppRelease: AppReleaseInfo = {
        appBuild: toReleaseString(standardizedProps.$app_build),
        appVersion: toReleaseString(standardizedProps.$app_version),
      };

      // A failed cache read is not the same as an absent entry: treating it
      // as a fresh install would inflate `$app_installed` on transient
      // storage errors, so the session degrades to `$app_opened` only and
      // the install/update event is lost for this launch. The native SDKs
      // apply the same rule.
      const cachedRelease = yield* cacheManager
        .get<AppReleaseInfo>(ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY)
        .pipe(
          Effect.map((hit) => Option.some(Option.map(hit, (entry) => entry.value))),
          // oxlint-disable-next-line effect/effect-catchall-default -- deliberate blanket recovery: any read failure must mean "unknown previous release", never "fresh install" (see the comment above).
          Effect.catchCause(() => Effect.succeed(Option.none<Option.Option<AppReleaseInfo>>())),
        );
      const releaseEvent = Option.flatMap(cachedRelease, (previousAppRelease) =>
        Option.match(previousAppRelease, {
          onNone: () => Option.some(AUTOMATIC_EVENTS.APP_INSTALLED),
          onSome: (previous) =>
            previous.appBuild !== currentAppRelease.appBuild ||
            previous.appVersion !== currentAppRelease.appVersion
              ? Option.some(AUTOMATIC_EVENTS.APP_UPDATED)
              : Option.none(),
        }),
      );
      const eventNames = Option.match(releaseEvent, {
        onNone: () => [AUTOMATIC_EVENTS.APP_OPENED],
        onSome: (eventName) => [eventName, AUTOMATIC_EVENTS.APP_OPENED],
      });
      const now = yield* Clock.currentTimeMillis;
      const sessionId = sessionManager.touchUnsafe();
      const distinctId = identityManager.getDistinctIdUnsafe();
      const additions = eventNames.map((eventName) =>
        createQueuedAnalyticsEventUnsafe(eventName, {}, sessionId, distinctId, now),
      );
      yield* enqueue(additions);

      yield* cacheManager.set(ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY, currentAppRelease).pipe(
        // oxlint-disable-next-line effect/effect-catchall-default -- deliberate blanket recovery: a failed write costs at most one duplicated install/update event on the next launch, and must not fail startup.
        Effect.catchCause((cause) =>
          diagnostics.emit({
            code: DIAGNOSTIC_CODES.CACHE_WRITE_FAILED,
            kind: "cache",
            message: `Could not record the seen app release: ${Cause.pretty(cause)}`,
            operation: "capture",
            retryable: true,
          }),
        ),
      );
    },
  );

  // Background flush daemon: wakes on either the 5s tick or a threshold
  // signal from `capture`, then fires the registered callback so the outer
  // wrapper can route the flush through its single-flight guard. An empty
  // queue is left alone: a flush would only rewrite the session to
  // storage for nothing. Forked into the service scope — interrupted
  // automatically on runtime dispose.
  const daemon = Effect.forever(
    Effect.fn("AnalyticsService.flushDaemonTick")(function* () {
      yield* Effect.race(Effect.sleep(Duration.millis(ANALYTICS_FLUSH_INTERVAL_MS)), latch.await);
      yield* latch.close;
      if (Arr.isReadonlyArrayEmpty(Ref.getUnsafe(queueRef))) return;
      yield* Effect.sync(() =>
        Option.getOrElse(MutableRef.get(flushCallbackRef), () => () => undefined)(),
      );
    })(),
  );
  yield* Effect.forkScoped(daemon);

  // Persist-behind daemon: coalesces queue mutations into one storage
  // write per 250 ms, or an immediate write once 20 events are pending.
  // The write itself is skipped when nothing changed since the last one.
  const persistDaemon = Effect.forever(
    Effect.fn("AnalyticsService.persistDaemonTick")(function* () {
      yield* persistLatch.await;
      yield* persistLatch.close;
      yield* Effect.race(
        Effect.sleep(Duration.millis(ANALYTICS_PERSIST_DEBOUNCE_MS)),
        persistNowLatch.await,
      );
      yield* persistNowLatch.close;
      yield* persistQueue();
    })(),
  );
  yield* Effect.forkScoped(persistDaemon);

  return {
    capture,
    captureAutomaticStartupEvents,
    flush,
    getQueueLength: () => Ref.getUnsafe(queueRef).length + MutableRef.get(inFlightRef).length,
    getStandardizedProperties: () => getStandardizedProperties,
    /** Forces the persist-behind write. Used on background transitions. */
    persistQueue,
    sendAnalyticsEvents,
    setFlushCallback: (cb: () => void) => {
      MutableRef.set(flushCallbackRef, Option.some(cb));
    },
    /**
     * Starts a flush on its own fiber in the service scope and hands the
     * fiber back, so a caller can wait on it with a deadline without
     * interrupting the send when the deadline passes.
     */
    startFlush: () => Effect.forkIn(flush(), serviceScope, { startImmediately: true }),
    transferEvents,
  } as const;
});

/** Persistent analytics queue and delivery service for the React Native SDK. */
export class AnalyticsService extends Context.Service<
  AnalyticsService,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/AnalyticsService") {
  static readonly layer = Layer.effect(AnalyticsService, make());
}
