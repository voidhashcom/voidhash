import { Clock, Context, DateTime, Effect, Fiber, Layer, Schema } from "effect";
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
const RETRYABLE_ERROR_CODES = new Set(["rate_limited", "dependency_unavailable", "internal_error"]);
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
  new Set(events.map((event) => event.id));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const optionalNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  return undefined;
};

const isCaptureAcceptedResponse = (value: unknown): value is CaptureAcceptedResponse => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.accepted === "number" && typeof value.rejected === "number";
};

const extractCaptureError = (input: {
  data?: unknown;
  status: number;
}): { code: string; retry_after_ms?: number } | null => {
  if (isRecord(input.data) && typeof input.data.code === "string") {
    return {
      code: input.data.code,
      retry_after_ms: optionalNumber(input.data.retry_after_ms),
    };
  }

  switch (input.status) {
    case 400:
      return { code: "invalid_request" };
    case 401:
      return { code: "unauthorized" };
    case 413:
      return { code: "payload_too_large" };
    case 429:
      return { code: "rate_limited" };
    case 500:
      return { code: "internal_error" };
    case 503:
      return { code: "dependency_unavailable" };
    default:
      return null;
  }
};

const make = Effect.gen(function* effect() {
  const cacheManager = yield* CacheManager;
  const config = yield* SdkConfiguration;
  const eventBus = yield* EventBusProvider;
  const httpClient = yield* HttpClient.HttpClient;
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;

  // Mutable queue state
  let events: QueuedAnalyticsEvent[] = [];
  let isLoaded = false;
  let flushTickerFiber: Fiber.Fiber<never, never> | null = null;

  // Queue persistence
  const loadQueue = () =>
    Effect.gen(function* loadQueue() {
      if (isLoaded) return;
      const cached = yield* cacheManager.get<QueuedAnalyticsEvent[]>(QUEUE_KEY);
      events = cached?.value ?? [];
      isLoaded = true;
    });

  const persistQueue = () => cacheManager.set(QUEUE_KEY, events);

  // Queue operations
  const dropEvents = (ids: ReadonlySet<string>) => {
    events = events.filter((event) => !ids.has(event.id));
  };

  const postponeEvents = (ids: ReadonlySet<string>, nextAvailableAt: number) => {
    events = events.map((event) => {
      if (!ids.has(event.id)) return event;
      return { ...event, attempts: event.attempts + 1, availableAt: nextAvailableAt };
    });
  };

  const peekBatch = (input: { maxBatchBytes: number; maxBatchSize: number; now: number }) => {
    const dueEvents = events.filter((event) => event.availableAt <= input.now);
    if (dueEvents.length === 0) return [];

    const firstDistinctId = dueEvents[0]?.payload.distinct_id;
    const selected: QueuedAnalyticsEvent[] = [];
    let totalBytes = 0;

    for (const event of dueEvents) {
      if (event.payload.distinct_id !== firstDistinctId) break;
      const nextBytes = estimateEventBytes(event);
      if (selected.length > 0 && totalBytes + nextBytes > input.maxBatchBytes) break;
      selected.push(event);
      totalBytes += nextBytes;
      if (selected.length >= input.maxBatchSize) break;
    }

    return selected;
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
  ): Effect.Effect<AnalyticsFlushResult | null> =>
    Effect.gen(function* sendBatchEffect() {
      if (batch.length === 0) return null;

      const distinctId = batch[0]?.payload.distinct_id;
      if (!distinctId) return null;

      const batchPayloads = batch.map((entry) => entry.payload);
      const ids = buildIdSet(batch);

      // keepalive sends are best-effort and fire-and-forget
      if (options?.keepalive) {
        const result = yield* Effect.exit(sendBatchKeepalive(batchPayloads));
        if (result._tag === "Success") {
          dropEvents(ids);
          yield* persistQueue();
        }
        return null;
      }

      const result = yield* Effect.exit(sendBatchViaClient(batchPayloads));

      if (result._tag === "Success") {
        if (result.value.status === 202) {
          const capture = result.value.data;
          if (!isCaptureAcceptedResponse(capture)) {
            const retryAt = yield* Clock.currentTimeMillis;
            postponeEvents(ids, retryAt + getBackoffMs((batch[0]?.attempts ?? 0) + 1));
            yield* persistQueue();
            return null;
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
          return flushResult;
        }

        const error = extractCaptureError(result.value);

        if (error?.code === "payload_too_large") {
          return yield* handlePayloadTooLarge(batch, options);
        }

        if (error && RETRYABLE_ERROR_CODES.has(error.code)) {
          const retryAt = yield* Clock.currentTimeMillis;
          postponeEvents(
            ids,
            retryAt + (error.retry_after_ms ?? getBackoffMs((batch[0]?.attempts ?? 0) + 1)),
          );
          yield* persistQueue();
          return null;
        }

        if (error) {
          dropEvents(ids);
          yield* persistQueue();
          eventBus.emit("error", {
            message: `Dropping analytics batch after non-retryable ${error.code} response.`,
            source: "analytics",
          });
          return null;
        }
      }

      const retryAt = yield* Clock.currentTimeMillis;
      postponeEvents(ids, retryAt + getBackoffMs((batch[0]?.attempts ?? 0) + 1));
      yield* persistQueue();
      return null;
    });

  const handlePayloadTooLarge = (
    batch: ReadonlyArray<QueuedAnalyticsEvent>,
    options?: { keepalive?: boolean },
  ): Effect.Effect<AnalyticsFlushResult | null> =>
    Effect.gen(function* handlePayloadTooLargeEffect() {
      if (batch.length === 1) {
        dropEvents(buildIdSet(batch));
        yield* persistQueue();
        eventBus.emit("error", {
          message: "Dropping analytics event after 413 response.",
          source: "analytics",
        });
        const dropped: AnalyticsFlushResult = { accepted: 0, rejected: 1 };
        return dropped;
      }

      const midpoint = Math.ceil(batch.length / 2);
      const first = yield* sendBatch(batch.slice(0, midpoint), options);
      const second = yield* sendBatch(batch.slice(midpoint), options);

      if (!first && !second) return null;

      const merged: AnalyticsFlushResult = {
        accepted: (first?.accepted ?? 0) + (second?.accepted ?? 0),
        rejected: (first?.rejected ?? 0) + (second?.rejected ?? 0),
        requestId: second?.requestId ?? first?.requestId,
      };
      return merged;
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
      if (!distinctId) return;

      const event = createAnalyticsEvent(platform, distinctId, eventName, properties, options);
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

  const flush = (options?: { keepalive?: boolean }): Effect.Effect<AnalyticsFlushResult | null> =>
    Effect.gen(function* flushEffect() {
      yield* loadQueue();
      const now = yield* Clock.currentTimeMillis;
      const batch = peekBatch({
        maxBatchBytes: config.analytics.maxBatchBytes,
        maxBatchSize: Math.min(config.analytics.maxBatchSize, MAX_INGEST_BATCH_SIZE),
        now,
      });
      if (batch.length === 0) return null;
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

  const start = () => {
    if (flushTickerFiber) return;
    flushTickerFiber = Effect.runFork(flushTicker);
  };

  const stop = () => {
    if (!flushTickerFiber) return;
    Effect.runFork(Fiber.interrupt(flushTickerFiber));
    flushTickerFiber = null;
  };

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
  Effect.Success<typeof make>
>()("web-voidhash/AnalyticsService") {
  static Default = Layer.effect(AnalyticsService, make);
}
