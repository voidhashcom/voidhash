import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { CaptureAcceptedResponse } from "@voidhash/generated-clients/event-capture";

import type { AnalyticsFlushResult, AnalyticsFlushStatus } from "../../types";
import { CacheAdapter } from "../caching/cache-adapter";
import { CacheManager } from "../caching/cache-manager";
import { Diagnostics } from "../diagnostics";
import { EventBusProvider } from "../event-bus";
import { IdentityManager } from "../identity/identity-manager";
import { AuthGate } from "../networking/auth-gate";
import { CircuitBreaker } from "../networking/circuit-breaker";
import {
  QUEUE_BACKOFF_CAP_MS,
  REQUEST_TIMEOUT_MS,
  backoffMs,
  breakerKey,
  countsTowardsBreaker,
  isAuthStatus,
  isRetryableStatus,
  resolveRetryAfterMs,
} from "../networking/network-policy";
import { SingleFlight } from "../networking/single-flight";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";
import { createAnalyticsEvent } from "./analytics-context";
import { holdQueueOwnerLock, isQueueOwnerAlive, withQueueLock } from "./queue-lock";
import type { AnalyticsRequestEvent, QueuedAnalyticsEvent } from "./contracts";

// Each tab owns one queue segment and is the only writer of that key, so two
// tabs appending at the same time can never overwrite each other's events. A
// segment left behind by a closed tab is adopted by a surviving tab under the
// maintenance lock.
const QUEUE_SEGMENT_PREFIX = "analytics:queue:";
const QUEUE_OWNER_PREFIX = "analytics:owner:";
// Queue key used before segments existed; adopted once on first flush.
const SHARED_QUEUE_KEY = "analytics:queue";
const MAINTENANCE_LOCK_KEY = "vh:lock:analytics-flush";
const OWNER_LOCK_PREFIX = "vh:lock:analytics-owner:";
const FLUSH_SINGLE_FLIGHT_KEY = "analytics:flush";
const MAX_INGEST_BATCH_SIZE = 100;
// Browsers cap `keepalive` request bodies at 64 KB; anything above is rejected
// outright, so the pagehide flush sends at most that much and leaves the rest.
const KEEPALIVE_MAX_BATCH_BYTES = 64 * 1024;
const ANALYTICS_SEND_FAILURE: { readonly _tag: "AnalyticsSendFailure" } = {
  _tag: "AnalyticsSendFailure",
};
const KEEPALIVE_SEND_FAILURE: { readonly _tag: "KeepaliveSendFailure" } = {
  _tag: "KeepaliveSendFailure",
};

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;

const estimateEventBytes = (event: QueuedAnalyticsEvent) => byteLength(encodeJson(event.payload));

const buildIdSet = (events: ReadonlyArray<QueuedAnalyticsEvent>) =>
  HashSet.fromIterable(events.map((event) => event.id));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value) && value !== null;

const optionalNumber = (value: unknown) => {
  if (P.isNumber(value)) {
    return value;
  }
  return undefined;
};

const isCaptureAcceptedResponse = (value: unknown): value is CaptureAcceptedResponse => {
  if (!isRecord(value)) {
    return false;
  }
  return P.isNumber(value.accepted) && P.isNumber(value.rejected);
};

const extractCaptureError = (input: {
  data?: unknown;
  status: number;
}): Option.Option<{ code: string; retry_after_ms?: number }> => {
  if (isRecord(input.data) && P.isString(input.data.code)) {
    return Option.some({
      code: input.data.code,
      retry_after_ms: optionalNumber(input.data.retry_after_ms),
    });
  }

  return Match.value(input.status).pipe(
    Match.when(400, () => Option.some({ code: "invalid_request" })),
    Match.when(401, () => Option.some({ code: "unauthorized" })),
    Match.when(413, () => Option.some({ code: "payload_too_large" })),
    Match.when(429, () => Option.some({ code: "rate_limited" })),
    Match.when(500, () => Option.some({ code: "internal_error" })),
    Match.when(503, () => Option.some({ code: "dependency_unavailable" })),
    Match.orElse(() => Option.none()),
  );
};

const make = Effect.fn("makeAnalyticsService")(function* effect() {
  const authGate = yield* AuthGate;
  const breaker = yield* CircuitBreaker;
  const cacheManager = yield* CacheManager;
  const config = yield* SdkConfiguration;
  const diagnostics = yield* Diagnostics;
  const eventBus = yield* EventBusProvider;
  const httpClient = yield* HttpClient.HttpClient;
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;
  const cacheAdapter = yield* CacheAdapter;
  const singleFlight = yield* SingleFlight;

  const ingestBreakerKey = breakerKey("ingest", config.analytics.baseUrl);
  const tabId = platform.randomId();
  const segmentKey = `${QUEUE_SEGMENT_PREFIX}${tabId}`;
  const ownerKey = `${QUEUE_OWNER_PREFIX}${tabId}`;
  const ownerLockKey = `${OWNER_LOCK_PREFIX}${tabId}`;

  // Mutable queue state
  let events: QueuedAnalyticsEvent[] = [];
  let isLoaded = false;
  let lastError = Option.none<string>();
  let flushTickerFiber = Option.none<Fiber.Fiber<never, never>>();
  let ownerLockRelease = Option.none<() => void>();

  const heartbeat = () =>
    Effect.flatMap(Clock.currentTimeMillis, (now) => cacheManager.set(ownerKey, now));

  // Queue persistence. Only this tab ever writes `segmentKey`.
  const loadQueue = (options?: { readonly refresh?: boolean }) =>
    Effect.gen(function* loadQueue() {
      if (isLoaded && !options?.refresh) return;
      const cached = yield* cacheManager.get<QueuedAnalyticsEvent[]>(segmentKey, options);
      events = Option.match(cached, { onNone: () => [], onSome: (hit) => hit.value });
      isLoaded = true;
    });

  const persistQueue = () =>
    Effect.gen(function* persistQueue() {
      yield* cacheManager.set(segmentKey, events);
      yield* heartbeat();
    });

  const isOrphanSegment = (key: string) =>
    Effect.gen(function* isOrphanSegment() {
      if (key === SHARED_QUEUE_KEY) {
        return true;
      }
      const owner = key.slice(QUEUE_SEGMENT_PREFIX.length);
      const heartbeat = yield* cacheManager.get<number>(`${QUEUE_OWNER_PREFIX}${owner}`, {
        refresh: true,
      });
      const alive = yield* isQueueOwnerAlive(`${OWNER_LOCK_PREFIX}${owner}`);
      if (Option.isSome(alive)) return !alive.value;

      // A suspended page can miss heartbeats indefinitely. Without Web Locks,
      // only a missing marker from clean shutdown proves the owner is gone.
      return Option.match(heartbeat, {
        onNone: () => true,
        onSome: () => false,
      });
    });

  /**
   * Takes over one segment if its owner is gone, returning how many events were
   * inherited.
   */
  const adoptSegment = (key: string) =>
    Effect.gen(function* adoptSegment() {
      if (!(yield* isOrphanSegment(key))) return 0;

      const segment = yield* cacheManager.get<QueuedAnalyticsEvent[]>(key, { refresh: true });
      const orphaned = Option.match(segment, {
        onNone: (): ReadonlyArray<QueuedAnalyticsEvent> => [],
        onSome: (hit) => hit.value,
      });
      events = [...events, ...orphaned];

      yield* cacheManager.delete(key);
      if (key !== SHARED_QUEUE_KEY) {
        yield* cacheManager.delete(
          `${QUEUE_OWNER_PREFIX}${key.slice(QUEUE_SEGMENT_PREFIX.length)}`,
        );
      }

      return orphaned.length;
    });

  /**
   * Moves events left behind by closed tabs into this tab's segment. Runs under
   * the maintenance lock so two tabs cannot adopt the same segment.
   */
  const adoptOrphanSegments = () =>
    Effect.gen(function* adoptOrphanSegments() {
      const keys = yield* cacheManager.getCacheKeys();
      const candidates = keys.filter(
        (key) =>
          key !== segmentKey && (key === SHARED_QUEUE_KEY || key.startsWith(QUEUE_SEGMENT_PREFIX)),
      );
      if (Arr.isReadonlyArrayEmpty(candidates)) return;

      const adoptedCounts = yield* Effect.forEach(candidates, (key) => adoptSegment(key), {
        concurrency: 1,
      });

      if (Arr.some(adoptedCounts, (count) => count > 0)) {
        yield* enforceQueueCap();
        yield* persistQueue();
      }
    });

  // Queue operations
  /** Trims the queue to its cap, evicting the oldest events first. */
  const enforceQueueCap = () =>
    Effect.gen(function* enforceQueueCap() {
      const droppedCount = Math.max(events.length - config.analytics.maxQueueSize, 0);
      if (droppedCount === 0) return;

      events.splice(0, droppedCount);
      const message = `Dropped ${droppedCount} analytics event(s) because the queue is full.`;
      eventBus.emit("error", { message, source: "analytics" });
      yield* diagnostics.report({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message,
        operation: "analytics.enqueue",
        retryable: false,
      });
    });

  const dropEvents = (ids: HashSet.HashSet<string>) => {
    events = events.filter((event) => !HashSet.has(ids, event.id));
  };

  const postponeEvents = (ids: HashSet.HashSet<string>, nextAvailableAt: number) => {
    events = events.map((event) => {
      if (!HashSet.has(ids, event.id)) return event;
      return { ...event, attempts: event.attempts + 1, availableAt: nextAvailableAt };
    });
  };

  const peekBatch = (input: { maxBatchBytes: number; maxBatchSize: number; now: number }) => {
    const dueEvents = events.filter((event) => event.availableAt <= input.now);
    if (Arr.isReadonlyArrayEmpty(dueEvents)) return [];

    const firstDistinctId = dueEvents[0]?.payload.distinct_id;
    const initial: {
      readonly selected: ReadonlyArray<QueuedAnalyticsEvent>;
      readonly stopped: boolean;
      readonly totalBytes: number;
    } = { selected: [], stopped: false, totalBytes: 0 };
    const result = Arr.reduce(dueEvents, initial, (state, event) => {
      if (state.stopped || event.payload.distinct_id !== firstDistinctId) {
        return { ...state, stopped: true };
      }
      const nextBytes = estimateEventBytes(event);
      if (
        Arr.isReadonlyArrayNonEmpty(state.selected) &&
        state.totalBytes + nextBytes > input.maxBatchBytes
      ) {
        return { ...state, stopped: true };
      }
      const selected = [...state.selected, event];
      return {
        selected,
        stopped: selected.length >= input.maxBatchSize,
        totalBytes: state.totalBytes + nextBytes,
      };
    });

    return result.selected;
  };

  const buildBatchRequest = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.gen(function* buildBatchRequest() {
      const sentAt = yield* DateTime.nowAsDate;
      return HttpClientRequest.post(new URL("/batch", config.analytics.baseUrl)).pipe(
        HttpClientRequest.bodyJsonUnsafe({
          events: batchEvents,
          sent_at: sentAt.toISOString(),
          token: config.publishableKey,
        }),
      );
    });

  const sendBatchViaClient = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.gen(function* sendBatchViaClient() {
      const request = yield* buildBatchRequest(batchEvents);
      const response = yield* httpClient.execute(request);
      const data = yield* response.json.pipe(Effect.orElseSucceed(() => undefined));

      return {
        data,
        headers: response.headers,
        status: response.status,
      };
    }).pipe(
      Effect.timeout(REQUEST_TIMEOUT_MS),
      Effect.mapError(() => ANALYTICS_SEND_FAILURE),
    );

  // Best-effort delivery on pagehide: `keepalive` lets the browser finish the
  // request after the document is gone, so it is supplied as a fetch-level
  // option rather than as part of the request itself.
  const sendBatchKeepalive = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.gen(function* sendBatchKeepalive() {
      const request = yield* buildBatchRequest(batchEvents);
      return yield* httpClient.execute(request);
    }).pipe(
      Effect.timeout(REQUEST_TIMEOUT_MS),
      Effect.provideService(FetchHttpClient.RequestInit, { keepalive: true }),
      Effect.mapError(() => KEEPALIVE_SEND_FAILURE),
    );

  const reportTransport = (input: {
    code: string;
    httpStatus?: number;
    message: string;
    retryable: boolean;
  }) =>
    Effect.gen(function* reportTransport() {
      lastError = Option.some(input.message);
      yield* diagnostics.report({
        code: input.code,
        httpStatus: input.httpStatus,
        kind: "transport",
        message: input.message,
        operation: "analytics.flush",
        retryable: input.retryable,
      });
    });

  /**
   * Reschedules the batch. Batches are never dropped for transport reasons, so
   * the attempt counter only feeds the backoff, never a give-up threshold.
   */
  const rescheduleBatch = (
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    ids: HashSet.HashSet<string>,
    delayMs: Option.Option<number> = Option.none(),
  ) =>
    Effect.gen(function* rescheduleBatch() {
      const now = yield* Clock.currentTimeMillis;
      const backoff = yield* Option.match(delayMs, {
        onNone: () => backoffMs((batch[0]?.attempts ?? 0) + 1, QUEUE_BACKOFF_CAP_MS),
        onSome: Effect.succeed,
      });
      postponeEvents(ids, now + backoff);
      yield* persistQueue();
    });

  const pauseForAuth = (status: number) =>
    Effect.gen(function* pauseForAuth() {
      lastError = Option.some(`Authentication failed with status ${status}.`);
      yield* authGate.pause({ httpStatus: status, operation: "analytics.flush" });
    });

  const dropBatch = (
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    ids: HashSet.HashSet<string>,
    status: number,
  ) =>
    Effect.gen(function* dropBatch() {
      dropEvents(ids);
      yield* persistQueue();
      const message = `Dropping ${batch.length} analytics event(s) after a non-retryable ${status} response.`;
      lastError = Option.some(message);
      eventBus.emit("error", { message, source: "analytics" });
      yield* diagnostics.report({
        code: "ANALYTICS_EVENT_DROPPED",
        httpStatus: status,
        kind: "eviction",
        message,
        operation: "analytics.flush",
        retryable: false,
      });
    });

  // Core flush logic
  const sendBatch = (
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    options?: { authProbe?: boolean; keepalive?: boolean; skipBreaker?: boolean },
  ): Effect.Effect<Option.Option<AnalyticsFlushResult>> =>
    Effect.gen(function* sendBatchEffect() {
      if (Arr.isReadonlyArrayEmpty(batch)) return Option.none();

      const distinctId = batch[0]?.payload.distinct_id;
      if (!distinctId) return Option.none();

      const batchPayloads = batch.map((entry) => entry.payload);
      const ids = buildIdSet(batch);

      // keepalive sends are best-effort and fire-and-forget
      if (options?.keepalive) {
        const result = yield* Effect.exit(sendBatchKeepalive(batchPayloads));
        if (Exit.isSuccess(result) && result.value.status === 202) {
          dropEvents(ids);
          yield* persistQueue();
        }
        return Option.none();
      }

      // The recursive halving of a 413 reuses the probe taken by the outer
      // attempt instead of asking the breaker again.
      if (!options?.skipBreaker) {
        const mayAttempt = yield* breaker.canAttempt(ingestBreakerKey, "analytics.flush");
        if (!mayAttempt) {
          yield* rescheduleBatch(batch, ids);
          return Option.none();
        }
      }

      const result = yield* Effect.exit(sendBatchViaClient(batchPayloads));

      if (Exit.isSuccess(result)) {
        const { headers, status } = result.value;
        if (options?.authProbe) {
          yield* authGate.completeProbe(!isAuthStatus(status));
        }

        if (status === 202) {
          const capture = result.value.data;
          yield* breaker.recordSuccess(ingestBreakerKey);
          if (!isCaptureAcceptedResponse(capture)) {
            yield* reportTransport({
              code: "MALFORMED_CAPTURE_RESPONSE",
              httpStatus: status,
              message: "Ingest accepted the batch but returned an unreadable body.",
              retryable: true,
            });
            yield* rescheduleBatch(batch, ids);
            return Option.none();
          }

          dropEvents(ids);
          lastError = Option.none();
          yield* persistQueue();
          const flushResult: AnalyticsFlushResult = {
            accepted: capture.accepted,
            rejected: capture.rejected,
          };
          eventBus.emit("analytics-flushed", flushResult);
          if (flushResult.rejected > 0) {
            eventBus.emit("analytics-partial-rejection", flushResult);
          }
          return Option.some(flushResult);
        }

        if (status >= 200 && status < 300) {
          yield* breaker.recordSuccess(ingestBreakerKey);
          yield* reportTransport({
            code: "ANALYTICS_UNEXPECTED_STATUS",
            httpStatus: status,
            message: `Ingest returned ${status}; only 202 confirms delivery, so the batch stays queued.`,
            retryable: true,
          });
          yield* rescheduleBatch(batch, ids);
          return Option.none();
        }

        if (isAuthStatus(status)) {
          yield* pauseForAuth(status);
          return Option.none();
        }

        const error = extractCaptureError(result.value);

        if (status === 413 || Option.exists(error, (it) => it.code === "payload_too_large")) {
          return yield* handlePayloadTooLarge(batch, options);
        }

        if (isRetryableStatus(status)) {
          if (countsTowardsBreaker(status)) {
            yield* breaker.recordFailure(ingestBreakerKey, "analytics.flush");
          }
          const now = yield* Clock.currentTimeMillis;
          const retryAfter = resolveRetryAfterMs(
            headers,
            Option.flatMap(error, (it) => Option.fromNullishOr(it.retry_after_ms)),
            now,
          );
          yield* reportTransport({
            code: "TRANSPORT_FAILED",
            httpStatus: status,
            message: `Ingest returned ${status}; the batch stays queued.`,
            retryable: true,
          });
          yield* rescheduleBatch(batch, ids, retryAfter);
          return Option.none();
        }

        // Anything else is a verdict about the payload (400, 404, 409, 422 and
        // friends). Retrying cannot change it and the batch would block the
        // head of the queue forever, so it is dropped with a diagnostic.
        yield* dropBatch(batch, ids, status);
        return Option.none();
      }

      yield* breaker.recordFailure(ingestBreakerKey, "analytics.flush");
      yield* reportTransport({
        code: "TRANSPORT_FAILED",
        message: "Ingest was unreachable; the batch stays queued.",
        retryable: true,
      });
      yield* rescheduleBatch(batch, ids);
      return Option.none();
    }).pipe(
      // Whatever the outcome, the probe slot taken above must be freed or the
      // half-open breaker would never admit another attempt.
      Effect.ensuring(
        Effect.all(
          [
            options?.skipBreaker || options?.keepalive
              ? Effect.void
              : breaker.releaseProbe(ingestBreakerKey),
            options?.authProbe ? authGate.completeProbe(false) : Effect.void,
          ],
          { concurrency: "unbounded", discard: true },
        ),
      ),
    );

  const handlePayloadTooLarge = (
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    options?: { authProbe?: boolean; keepalive?: boolean; skipBreaker?: boolean },
  ): Effect.Effect<Option.Option<AnalyticsFlushResult>> =>
    Effect.gen(function* handlePayloadTooLargeEffect() {
      if (batch.length === 1) {
        dropEvents(buildIdSet(batch));
        yield* persistQueue();
        eventBus.emit("error", {
          message: "Dropping analytics event after 413 response.",
          source: "analytics",
        });
        yield* diagnostics.report({
          code: "ANALYTICS_EVENT_DROPPED",
          httpStatus: 413,
          kind: "eviction",
          message: "Dropped a single analytics event the server refused as too large.",
          operation: "analytics.flush",
          retryable: false,
        });
        const dropped: AnalyticsFlushResult = { accepted: 0, rejected: 1 };
        return Option.some(dropped);
      }

      const midpoint = Math.ceil(batch.length / 2);
      const halved = { ...options, skipBreaker: true };
      const first = yield* sendBatch(batch.slice(0, midpoint), halved);
      const second = yield* sendBatch(batch.slice(midpoint), halved);

      if (Option.isNone(first) && Option.isNone(second)) return Option.none();

      const firstValue = Option.getOrUndefined(first);
      const secondValue = Option.getOrUndefined(second);
      const requestId = secondValue?.requestId ?? firstValue?.requestId;

      const merged: AnalyticsFlushResult = {
        accepted: (firstValue?.accepted ?? 0) + (secondValue?.accepted ?? 0),
        rejected: (firstValue?.rejected ?? 0) + (secondValue?.rejected ?? 0),
        ...(requestId ? { requestId } : {}),
      };
      return Option.some(merged);
    });

  // Public API
  const enqueue = (
    eventName: string,
    properties?: Record<string, unknown>,
    options?: {
      eventId?: string;
      sessionId?: string;
      timestamp?: string;
    },
  ) =>
    Effect.gen(function* enqueue() {
      yield* loadQueue();

      const distinctId = identityManager.getDistinctId();
      if (Option.isNone(distinctId)) return;

      const event = yield* createAnalyticsEvent(
        platform,
        distinctId.value,
        eventName,
        properties,
        options,
      );
      const availableAt = yield* Clock.currentTimeMillis;

      events.push({
        attempts: 0,
        availableAt,
        id: event.uuid,
        payload: event,
      });

      yield* enforceQueueCap();
      yield* persistQueue();
      return events.length;
    });

  const buildStatus = (flushed: number): AnalyticsFlushStatus => ({
    flushed,
    ...(Option.isSome(lastError) ? { lastError: lastError.value } : {}),
    pending: events.length,
  });

  /**
   * Trims a batch to what fits in a `keepalive` body. The browser limit covers
   * the whole serialized request, so the envelope and the separators count
   * against it and there is no exemption for the first event: an event that
   * does not fit on its own is left for the next page load.
   */
  const withinKeepaliveBudget = (batch: ReadonlyArray<QueuedAnalyticsEvent>, sentAt: string) => {
    const envelopeBytes = byteLength(
      encodeJson({ events: [], sent_at: sentAt, token: config.publishableKey }),
    );
    const budget = Math.min(config.analytics.maxBatchBytes, KEEPALIVE_MAX_BATCH_BYTES);

    const initial: {
      readonly selected: ReadonlyArray<QueuedAnalyticsEvent>;
      readonly stopped: boolean;
      readonly usedBytes: number;
    } = { selected: [], stopped: false, usedBytes: envelopeBytes };

    return Arr.reduce(batch, initial, (state, event) => {
      if (state.stopped) return state;
      const separatorBytes = Arr.isReadonlyArrayNonEmpty(state.selected) ? 1 : 0;
      const usedBytes = state.usedBytes + estimateEventBytes(event) + separatorBytes;
      if (usedBytes > budget) {
        return { ...state, stopped: true };
      }
      return { selected: [...state.selected, event], stopped: false, usedBytes };
    }).selected;
  };

  const flushOnce = (options?: { keepalive?: boolean }) =>
    Effect.gen(function* flushOnce() {
      yield* loadQueue();
      const now = yield* Clock.currentTimeMillis;
      const due = peekBatch({
        maxBatchBytes: config.analytics.maxBatchBytes,
        maxBatchSize: Math.min(config.analytics.maxBatchSize, MAX_INGEST_BATCH_SIZE),
        now,
      });
      const sentAt = yield* DateTime.now;
      const batch = options?.keepalive
        ? withinKeepaliveBudget(due, DateTime.formatIso(sentAt))
        : due;

      if (Arr.isReadonlyArrayEmpty(batch)) {
        if (options?.keepalive && Arr.isReadonlyArrayNonEmpty(due)) {
          yield* diagnostics.report({
            code: "KEEPALIVE_EVENT_TOO_LARGE",
            kind: "transport",
            message:
              "The next queued event exceeds the 64 KB keepalive limit; it is sent on the next page load.",
            operation: "analytics.flush",
            retryable: true,
          });
        }
        return buildStatus(0);
      }

      const authProbe =
        !options?.keepalive && authGate.isPaused() ? yield* authGate.probe() : false;
      if (authGate.isPaused() && !authProbe) return buildStatus(0);

      const result = yield* sendBatch(batch, { ...options, authProbe });
      return buildStatus(Option.match(result, { onNone: () => 0, onSome: (it) => it.accepted }));
    });

  /**
   * Sends the next due batch. Never fails: transport problems leave the events
   * queued and are reported through the returned status and the diagnostics
   * hook. Concurrent calls in this tab share one flush, and tabs sharing the
   * same storage coordinate through a lease so a batch is sent exactly once.
   */
  const flush = (options?: { keepalive?: boolean }): Effect.Effect<AnalyticsFlushStatus> =>
    Effect.gen(function* flushEffect() {
      yield* loadQueue();

      // On pagehide there is no time for cross-tab maintenance, and this tab
      // only ever touches its own segment, so the lock is not needed.
      if (options?.keepalive) {
        return yield* flushOnce(options);
      }

      // The heartbeat makes clean shutdown visible to browsers without Web
      // Locks; Web Locks distinguish a crashed page from a suspended one.
      yield* heartbeat();

      const adopt = withQueueLock({
        name: MAINTENANCE_LOCK_KEY,
        onSkipped: undefined,
        owner: tabId,
        work: adoptOrphanSegments(),
      }).pipe(Effect.provideService(CacheAdapter, cacheAdapter));

      return yield* singleFlight.run(
        Effect.flatMap(adopt, () => flushOnce(options)),
        FLUSH_SINGLE_FLIGHT_KEY,
      );
    });

  // Scheduled flushes need to be run through the runtime externally.
  // The eventBus signals that a flush is needed; the client handles execution.
  const flushTicker = Effect.forever(
    Effect.gen(function* flushTick() {
      yield* Effect.sleep(config.analytics.flushIntervalMs);
      eventBus.emit("analytics-flush-needed", undefined);
    }),
  );

  const start = () =>
    Effect.gen(function* startFlushTicker() {
      if (Option.isSome(flushTickerFiber)) return;
      ownerLockRelease = yield* holdQueueOwnerLock(ownerLockKey);
      yield* heartbeat();
      flushTickerFiber = Option.some(yield* Effect.forkDetach(flushTicker));
    });

  const stop = () =>
    Effect.gen(function* stopFlushTicker() {
      if (Option.isNone(flushTickerFiber)) return;
      yield* Fiber.interrupt(flushTickerFiber.value);
      flushTickerFiber = Option.none();
      Option.getOrElse(ownerLockRelease, () => () => undefined)();
      ownerLockRelease = Option.none();
      yield* cacheManager.delete(ownerKey);
    });

  const getQueueLength = () =>
    Effect.gen(function* getQueueLength() {
      yield* loadQueue();
      return events.length;
    });

  /**
   * Makes every queued event immediately due. Used when connectivity is
   * restored, where waiting out a backoff computed during the outage is
   * pointless.
   */
  const resetBackoff = () =>
    Effect.gen(function* resetBackoff() {
      yield* loadQueue();
      const now = yield* Clock.currentTimeMillis;
      events = events.map((event) => ({ ...event, availableAt: now }));
      yield* persistQueue();
    });

  return {
    enqueue,
    flush,
    getQueueLength,
    resetBackoff,
    start,
    stop,
  };
});

export class AnalyticsService extends Context.Service<
  AnalyticsService,
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/AnalyticsService") {
  static Default = Layer.effect(AnalyticsService, make());
}
