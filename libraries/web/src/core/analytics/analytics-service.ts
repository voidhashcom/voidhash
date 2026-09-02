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

import type { AnalyticsFlushResult } from "../../types";
import { CacheManager } from "../caching/cache-manager";
import { EventBusProvider } from "../event-bus";
import { IdentityManager } from "../identity/identity-manager";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";
import { createAnalyticsEvent } from "./analytics-context";
import type { AnalyticsRequestEvent, QueuedAnalyticsEvent } from "./contracts";

const QUEUE_KEY = "analytics:queue";
const MAX_INGEST_BATCH_SIZE = 100;
const RETRYABLE_ERROR_CODES = HashSet.fromIterable([
  "rate_limited",
  "dependency_unavailable",
  "internal_error",
]);
const getBackoffMs = (attempts: number) => Math.min(1000 * 2 ** Math.max(attempts - 1, 0), 30_000);

const ANALYTICS_SEND_FAILURE: { readonly _tag: "AnalyticsSendFailure" } = {
  _tag: "AnalyticsSendFailure",
};
const KEEPALIVE_SEND_FAILURE: { readonly _tag: "KeepaliveSendFailure" } = {
  _tag: "KeepaliveSendFailure",
};

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const estimateEventBytes = (event: QueuedAnalyticsEvent) =>
  new TextEncoder().encode(encodeJson(event.payload)).byteLength;

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
  const cacheManager = yield* CacheManager;
  const config = yield* SdkConfiguration;
  const eventBus = yield* EventBusProvider;
  const httpClient = yield* HttpClient.HttpClient;
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;

  // Mutable queue state
  let events: QueuedAnalyticsEvent[] = [];
  let isLoaded = false;
  let flushTickerFiber = Option.none<Fiber.Fiber<never, never>>();

  // Queue persistence
  const loadQueue = () =>
    Effect.gen(function* loadQueue() {
      if (isLoaded) return;
      const cached = yield* cacheManager.get<QueuedAnalyticsEvent[]>(QUEUE_KEY);
      events = Option.match(cached, { onNone: () => [], onSome: (hit) => hit.value });
      isLoaded = true;
    });

  const persistQueue = () => cacheManager.set(QUEUE_KEY, events);

  // Queue operations
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
        status: response.status,
      };
    }).pipe(Effect.mapError(() => ANALYTICS_SEND_FAILURE));

  // Best-effort delivery on pagehide: `keepalive` lets the browser finish the
  // request after the document is gone, so it is supplied as a fetch-level
  // option rather than as part of the request itself.
  const sendBatchKeepalive = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.gen(function* sendBatchKeepalive() {
      const request = yield* buildBatchRequest(batchEvents);
      return yield* httpClient.execute(request);
    }).pipe(
      Effect.provideService(FetchHttpClient.RequestInit, { keepalive: true }),
      Effect.mapError(() => KEEPALIVE_SEND_FAILURE),
    );

  // Core flush logic
  const sendBatch = (
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    options?: { keepalive?: boolean },
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
        if (Exit.isSuccess(result)) {
          dropEvents(ids);
          yield* persistQueue();
        }
        return Option.none();
      }

      const result = yield* Effect.exit(sendBatchViaClient(batchPayloads));

      if (Exit.isSuccess(result)) {
        if (result.value.status === 202) {
          const capture = result.value.data;
          if (!isCaptureAcceptedResponse(capture)) {
            const retryAt = yield* Clock.currentTimeMillis;
            postponeEvents(ids, retryAt + getBackoffMs((batch[0]?.attempts ?? 0) + 1));
            yield* persistQueue();
            return Option.none();
          }

          dropEvents(ids);
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

        const error = extractCaptureError(result.value);

        if (Option.isSome(error) && error.value.code === "payload_too_large") {
          return yield* handlePayloadTooLarge(batch, options);
        }

        if (Option.isSome(error) && HashSet.has(RETRYABLE_ERROR_CODES, error.value.code)) {
          const retryAt = yield* Clock.currentTimeMillis;
          postponeEvents(
            ids,
            retryAt + (error.value.retry_after_ms ?? getBackoffMs((batch[0]?.attempts ?? 0) + 1)),
          );
          yield* persistQueue();
          return Option.none();
        }

        if (Option.isSome(error)) {
          dropEvents(ids);
          yield* persistQueue();
          eventBus.emit("error", {
            message: `Dropping analytics batch after non-retryable ${error.value.code} response.`,
            source: "analytics",
          });
          return Option.none();
        }
      }

      const retryAt = yield* Clock.currentTimeMillis;
      postponeEvents(ids, retryAt + getBackoffMs((batch[0]?.attempts ?? 0) + 1));
      yield* persistQueue();
      return Option.none();
    });

  const handlePayloadTooLarge = (
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    options?: { keepalive?: boolean },
  ): Effect.Effect<Option.Option<AnalyticsFlushResult>> =>
    Effect.gen(function* handlePayloadTooLargeEffect() {
      if (batch.length === 1) {
        dropEvents(buildIdSet(batch));
        yield* persistQueue();
        eventBus.emit("error", {
          message: "Dropping analytics event after 413 response.",
          source: "analytics",
        });
        const dropped: AnalyticsFlushResult = { accepted: 0, rejected: 1 };
        return Option.some(dropped);
      }

      const midpoint = Math.ceil(batch.length / 2);
      const first = yield* sendBatch(batch.slice(0, midpoint), options);
      const second = yield* sendBatch(batch.slice(midpoint), options);

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

      const droppedCount = Math.max(events.length - config.analytics.maxQueueSize, 0);
      if (droppedCount > 0) {
        events.splice(0, droppedCount);
        eventBus.emit("error", {
          message: `Dropped ${droppedCount} analytics event(s) because the queue is full.`,
          source: "analytics",
        });
      }

      yield* persistQueue();
      return events.length;
    });

  const flush = (options?: {
    keepalive?: boolean;
  }): Effect.Effect<Option.Option<AnalyticsFlushResult>> =>
    Effect.gen(function* flushEffect() {
      yield* loadQueue();
      const now = yield* Clock.currentTimeMillis;
      const batch = peekBatch({
        maxBatchBytes: config.analytics.maxBatchBytes,
        maxBatchSize: Math.min(config.analytics.maxBatchSize, MAX_INGEST_BATCH_SIZE),
        now,
      });
      if (Arr.isReadonlyArrayEmpty(batch)) return Option.none();
      return yield* sendBatch(batch, options);
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
      flushTickerFiber = Option.some(yield* Effect.forkDetach(flushTicker));
    });

  const stop = () =>
    Effect.gen(function* stopFlushTicker() {
      if (Option.isNone(flushTickerFiber)) return;
      yield* Fiber.interrupt(flushTickerFiber.value);
      flushTickerFiber = Option.none();
    });

  const getQueueLength = () =>
    Effect.gen(function* getQueueLength() {
      yield* loadQueue();
      return events.length;
    });

  return {
    enqueue,
    flush,
    getQueueLength,
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
