import { Effect, Layer, Context } from "effect";
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

const estimateEventBytes = (event: QueuedAnalyticsEvent) =>
  new TextEncoder().encode(JSON.stringify(event.payload)).byteLength;

const buildIdSet = (events: ReadonlyArray<QueuedAnalyticsEvent>) =>
  new Set(events.map((event) => event.id));

const extractCaptureError = (input: {
  data?: unknown;
  status: number;
}): { code: string; retry_after_ms?: number } | null => {
  if (input.data && typeof input.data === "object") {
    const err = input.data as Record<string, unknown>;
    if (typeof err.code === "string") {
      return {
        code: err.code,
        retry_after_ms: typeof err.retry_after_ms === "number" ? err.retry_after_ms : undefined,
      };
    }
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
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;

  // Mutable queue state
  let events: QueuedAnalyticsEvent[] = [];
  let isLoaded = false;
  let flushIntervalId: ReturnType<typeof setInterval> | null = null;

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
    events = events.map((event) =>
      ids.has(event.id)
        ? { ...event, attempts: event.attempts + 1, availableAt: nextAvailableAt }
        : event,
    );
  };

  const peekBatch = (input: { maxBatchBytes: number; maxBatchSize: number }) => {
    const now = Date.now();
    const dueEvents = events.filter((event) => event.availableAt <= now);
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

  const sendBatchViaClient = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(new URL("/batch", config.analytics.baseUrl), {
          body: JSON.stringify({
            events: batchEvents,
            sent_at: new Date().toISOString(),
            token: config.publishableKey,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });

        let data: unknown;
        try {
          data = await response.json();
        } catch {
          data = undefined;
        }

        return {
          data,
          status: response.status,
        };
      },
      catch: () => ({ _tag: "AnalyticsSendFailure" as const }),
    });

  // Raw fetch fallback — only used for keepalive on pagehide
  const sendBatchKeepalive = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.tryPromise({
      try: () =>
        fetch(new URL("/batch", config.analytics.baseUrl), {
          body: JSON.stringify({
            events: batchEvents,
            sent_at: new Date().toISOString(),
            token: config.publishableKey,
          }),
          headers: { "content-type": "application/json" },
          keepalive: true,
          method: "POST",
        }),
      catch: () => ({ _tag: "KeepaliveSendFailure" as const }),
    });

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

      // keepalive sends use raw fetch (best-effort, fire-and-forget)
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
          if (
            !result.value.data ||
            typeof result.value.data !== "object" ||
            typeof (result.value.data as CaptureAcceptedResponse).accepted !== "number" ||
            typeof (result.value.data as CaptureAcceptedResponse).rejected !== "number"
          ) {
            postponeEvents(ids, Date.now() + getBackoffMs((batch[0]?.attempts ?? 0) + 1));
            yield* persistQueue();
            return null;
          }

          dropEvents(ids);
          yield* persistQueue();
          const response = result.value.data as CaptureAcceptedResponse;
          const flushResult: AnalyticsFlushResult = {
            accepted: response.accepted,
            rejected: response.rejected,
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
          postponeEvents(
            ids,
            Date.now() + (error.retry_after_ms ?? getBackoffMs((batch[0]?.attempts ?? 0) + 1)),
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

      postponeEvents(ids, Date.now() + getBackoffMs((batch[0]?.attempts ?? 0) + 1));
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
        return { accepted: 0, rejected: 1 } as AnalyticsFlushResult;
      }

      const midpoint = Math.ceil(batch.length / 2);
      const first = yield* sendBatch(batch.slice(0, midpoint), options);
      const second = yield* sendBatch(batch.slice(midpoint), options);

      if (!first && !second) return null;

      return {
        accepted: (first?.accepted ?? 0) + (second?.accepted ?? 0),
        rejected: (first?.rejected ?? 0) + (second?.rejected ?? 0),
        requestId: second?.requestId ?? first?.requestId,
      } as AnalyticsFlushResult;
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

      events.push({
        attempts: 0,
        availableAt: Date.now(),
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
      const batch = peekBatch({
        maxBatchBytes: config.analytics.maxBatchBytes,
        maxBatchSize: Math.min(config.analytics.maxBatchSize, MAX_INGEST_BATCH_SIZE),
      });
      if (batch.length === 0) return null;
      return yield* sendBatch(batch, options);
    });

  const start = () => {
    if (flushIntervalId) return;
    flushIntervalId = setInterval(() => {
      // Scheduled flushes need to be run through the runtime externally.
      // The eventBus signals that a flush is needed; the client handles execution.
      eventBus.emit("analytics-flush-needed", undefined);
    }, config.analytics.flushIntervalMs);
  };

  const stop = () => {
    if (flushIntervalId) {
      clearInterval(flushIntervalId);
      flushIntervalId = null;
    }
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
  } as const;
});

export class AnalyticsService extends Context.Service<
  AnalyticsService,
  Effect.Success<typeof make>
>()("web-voidhash/AnalyticsService") {
  static Default = Layer.effect(AnalyticsService, make);
}
