import {
  make as makeEventCaptureClient,
  type VoidhashEventCaptureClient,
} from "@voidhash/generated-clients/event-capture";
import {
  Duration,
  Effect,
  Latch,
  Layer,
  Ref,
  Schedule,
  Context,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { CacheManager } from "../caching/cache-manager";
import { IdentityManager } from "../identity/identity-manager";
import { SdkConfiguration } from "../sdk-configuration";
import { getNonce } from "../utils/crypto";
import {
  AnalyticsIngestEvent,
  AnalyticsSendFailure,
  QueuedAnalyticsEvent,
} from "./types";
import {
  createQueuedAnalyticsEvent,
  getAnalyticsStandardizedProperties,
  mapQueuedAnalyticsEventToIngestEvent,
} from "./utils";

const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_FLUSH_INTERVAL_MS = 5000;
const MAX_ANALYTICS_RETRY_DELAY_MS = 30_000;
/**
 * Status codes treated as retryable for raw HTTP failures that don't surface a
 * typed error from the generated event-capture client (e.g. 408, 502, 504).
 * 429/500/503 are also retryable but reach the catch handlers as their typed
 * counterparts and so don't go through the status-set fallback.
 */
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY =
  "voidhash:analytics:last-seen-app-release";

interface AppReleaseInfo {
  readonly appBuild: string | null;
  readonly appVersion: string | null;
}

const toNullableString = (value: unknown): string | null =>
  value !== null && value !== undefined ? String(value) : null;

const toAppReleaseInfo = (
  value: AppReleaseInfo | undefined | null
): AppReleaseInfo | null => {
  if (!value) return null;
  return {
    appBuild: value.appBuild,
    appVersion: value.appVersion,
  };
};

const getAnalyticsRetryDelayMs = (attempts: number) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), MAX_ANALYTICS_RETRY_DELAY_MS);

const parseRetryAfterMs = (
  value: string | null | undefined
): number | undefined => {
  if (!value) {
    return undefined;
  }

  const retryAfterSeconds = Number(value);
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.ceil(retryAfterSeconds * 1000);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(retryAt - Date.now(), 0);
};

/**
 * Inline retry schedule used inside `flush()`: exponential backoff capped at 3
 * total attempts. Retry-After-bearing failures are excluded via the `while`
 * predicate so they're postponed in the queue instead — preserving the
 * cool-down behavior expected by the rate-limit tests.
 */
const inlineRetrySchedule = Schedule.exponential(
  Duration.seconds(1),
  2
).pipe(Schedule.both(Schedule.recurs(2)));

/**
 * Owns the analytics pipeline: an in-memory event queue with batching, a
 * declarative retry schedule, `Retry-After` honouring, automatic startup
 * events (`app_installed` / `app_updated` / `app_opened`), and a periodic
 * flush daemon forked into the service scope. Disposing the runtime closes
 * the scope, which interrupts the daemon — no manual timer cleanup required.
 *
 * The synchronous `getQueueLength` and `setFlushCallback` methods exist so the
 * outer `VoidhashClient` wrapper can hook a background flush callback at init
 * time (which routes the daemon's flush through the wrapper's
 * `analyticsFlushInFlight` Promise guard) and tests can assert on queue length
 * without driving an Effect.
 */
export class AnalyticsService extends Context.Service<AnalyticsService>()(
  "rn-voidhash/AnalyticsService",
  {
    make: Effect.gen(function* () {
      const identityManager = yield* IdentityManager;
      const cacheManager = yield* CacheManager;
      const sdkConfiguration = yield* SdkConfiguration;
      const httpClient = yield* HttpClient.HttpClient;

      const queueRef = yield* Ref.make<ReadonlyArray<QueuedAnalyticsEvent>>([]);
      const latch = yield* Latch.make(false);
      const sessionId = getNonce();
      const getStandardizedProperties = getAnalyticsStandardizedProperties();
      let flushCallback: (() => void) | null = null;

      // The ingest endpoint lives on the same host as the API but under the
      // `/i/v1/...` path prefix. The generated client owns the path, so we
      // only need to inject the base origin via `prependUrl`. `ingestUrl`
      // remains as an override for local/test ingest servers.
      const ingestBaseUrl = sdkConfiguration.ingestUrl ?? sdkConfiguration.baseUrl;
      const eventCaptureClient = makeEventCaptureClient(
        httpClient as VoidhashEventCaptureClient["httpClient"],
        {
          transformClient: (client) =>
            Effect.succeed(
              client.pipe(
                HttpClient.mapRequest((request) =>
                  HttpClientRequest.prependUrl(request, ingestBaseUrl)
                )
              )
            ),
        }
      );

      const failNonRetryable = (status: number) =>
        Effect.fail(
          new AnalyticsSendFailure({
            message: `Analytics ingest request failed: ${status}`,
            retryable: false,
            status,
          })
        );

      const failRetryable = (status: number, retryAfterMs?: number) =>
        Effect.fail(
          new AnalyticsSendFailure({
            message: `Analytics ingest request failed: ${status}`,
            retryAfterMs,
            retryable: true,
            status,
          })
        );

      const sendAnalyticsEvents = (
        events: ReadonlyArray<AnalyticsIngestEvent>
      ): Effect.Effect<void, AnalyticsSendFailure> =>
        Effect.gen(function* () {
          if (events.length === 0) return;

          const distinctId = yield* identityManager.getDistinctId();
          yield* eventCaptureClient.eventCaptureBatch({
            events: events.map((event) => ({
              context: event.context,
              distinct_id: distinctId,
              event: event.event_name,
              properties: event.properties,
              session_id: event.session_id,
              timestamp: event.event_ts,
              uuid: event.event_id,
            })),
            sent_at: new Date().toISOString(),
            token: sdkConfiguration.publishableKey,
          });
        }).pipe(
          Effect.catchTags({
            CaptureDependencyUnavailableError: (err) =>
              failRetryable(err.response.status),
            CaptureInternalServerError: (err) =>
              failRetryable(err.response.status),
            CapturePayloadTooLargeError: (err) =>
              failNonRetryable(err.response.status),
            CaptureRateLimitedError: (err) =>
              failRetryable(
                err.response.status,
                parseRetryAfterMs(err.response.headers["retry-after"]) ??
                  err.data.retry_after_ms ??
                  undefined
              ),
            CaptureUnauthorizedError: (err) =>
              failNonRetryable(err.response.status),
            EventCaptureBatch400: (err) =>
              failNonRetryable(err.response.status),
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
                })
              );
            }
            return RETRYABLE_HTTP_STATUS_CODES.has(status)
              ? failRetryable(status)
              : failNonRetryable(status);
          })
        );

      // Inline retry wrapper used by the queue-draining `flush()` path. Public
      // `sendAnalyticsEvents` stays single-shot so callers can implement their
      // own retry strategy.
      const sendWithInlineRetry = (
        events: ReadonlyArray<AnalyticsIngestEvent>
      ) =>
        sendAnalyticsEvents(events).pipe(
          Effect.retry({
            schedule: inlineRetrySchedule,
            while: (failure: AnalyticsSendFailure) =>
              failure.retryable && failure.retryAfterMs === undefined,
          })
        );

      // Re-inserts a failed batch at the head of the queue with bumped
      // `availableAt` so the next due-check skips it until cool-down has
      // elapsed. Used only on retryable failures — successful sends and
      // non-retryable drops simply leave the events out of the queue, since
      // `takeDueBatch` already removed them.
      const postponeQueuedBatch = (
        events: ReadonlyArray<QueuedAnalyticsEvent>,
        nextAvailableAt: number
      ) =>
        Ref.update(queueRef, (queue) => {
          const postponed = events.map((event) => ({
            ...event,
            attempts: event.attempts + 1,
            availableAt: nextAvailableAt,
          }));
          return [...postponed, ...queue];
        });

      // Pops the next `due` batch (events whose `availableAt <= now`) from the
      // head of the queue. Treating taken events as "in flight" simplifies
      // failure handling: success means no further action, retryable failure
      // re-inserts via `postponeQueuedBatch`, and non-retryable failure leaves
      // them dropped.
      const takeDueBatch = () =>
        Ref.modify(queueRef, (queue) => {
          const now = Date.now();
          const batch: QueuedAnalyticsEvent[] = [];
          let cutoff = 0;

          for (const event of queue) {
            if (event.availableAt > now) break;
            batch.push(event);
            cutoff += 1;
            if (batch.length >= ANALYTICS_BATCH_SIZE) break;
          }

          const remaining = batch.length === 0 ? queue : queue.slice(cutoff);
          return [batch as ReadonlyArray<QueuedAnalyticsEvent>, remaining];
        });

      const processQueuedBatch = (
        queuedBatch: ReadonlyArray<QueuedAnalyticsEvent>,
        standardizedProperties: Record<string, unknown>
      ): Effect.Effect<void> => {
        const ingestBatch = queuedBatch.map((event) =>
          mapQueuedAnalyticsEventToIngestEvent(
            event,
            standardizedProperties,
            sessionId
          )
        );

        return sendWithInlineRetry(ingestBatch).pipe(
          Effect.catchTag("AnalyticsSendFailure", (failure) => {
            if (failure.status === 413 && queuedBatch.length > 1) {
              const midpoint = Math.ceil(queuedBatch.length / 2);
              return Effect.gen(function* () {
                yield* processQueuedBatch(
                  queuedBatch.slice(0, midpoint),
                  standardizedProperties
                );
                yield* processQueuedBatch(
                  queuedBatch.slice(midpoint),
                  standardizedProperties
                );
              });
            }

            if (failure.status === 413) {
              return Effect.logWarning(
                "Dropping analytics event after 413 response",
                { eventId: queuedBatch[0]?.id }
              );
            }

            if (failure.retryable) {
              const delayMs =
                failure.retryAfterMs ??
                getAnalyticsRetryDelayMs(
                  (queuedBatch[0]?.attempts ?? 0) + 1
                );
              return postponeQueuedBatch(queuedBatch, Date.now() + delayMs);
            }

            return Effect.logWarning(
              "Dropping analytics batch after non-retryable response",
              {
                eventIds: queuedBatch.map((event) => event.id),
                status: failure.status,
              }
            );
          })
        );
      };

      const capture = (
        eventName: string,
        properties: Record<string, unknown> = {}
      ) =>
        Effect.sync(() => {
          const normalized = eventName.trim();
          if (!normalized) return;
          const queued = createQueuedAnalyticsEvent(normalized, properties);
          // Direct mutation inside `Effect.sync` is safe: the Effect runtime
          // guarantees no other fiber crosses this sync boundary.
          const next = [...queueRef.ref.current, queued];
          queueRef.ref.current = next;
          if (next.length >= ANALYTICS_BATCH_SIZE) {
            // Wake the flush daemon immediately rather than waiting for the tick.
            latch.openUnsafe();
            flushCallback?.();
          }
        });

      const flush = () =>
        Effect.gen(function* () {
          const standardizedProperties = yield* getStandardizedProperties();

          let batch = yield* takeDueBatch();
          while (batch.length > 0) {
            yield* processQueuedBatch(batch, standardizedProperties);
            batch = yield* takeDueBatch();
          }
        });

      const transferEvents = (
        events: ReadonlyArray<{
          eventName: string;
          properties: Record<string, unknown>;
        }>
      ) =>
        Effect.sync(() => {
          const additions: QueuedAnalyticsEvent[] = [];
          for (const event of events) {
            const normalized = event.eventName.trim();
            if (!normalized) continue;
            additions.push(
              createQueuedAnalyticsEvent(normalized, event.properties)
            );
          }
          if (additions.length === 0) return;
          queueRef.ref.current = [...queueRef.ref.current, ...additions];
        });

      const captureAutomaticStartupEvents = () =>
        Effect.gen(function* () {
          const standardizedProps = yield* getStandardizedProperties();
          const currentAppRelease: AppReleaseInfo = {
            appBuild: toNullableString(standardizedProps.$app_build),
            appVersion: toNullableString(standardizedProps.$app_version),
          };

          // If reading the cached release fails, fall back to recording the
          // session as a fresh `app_opened`. Captures still flow through the
          // same queue so the failure mode is "lose the install/update event,"
          // not "drop the session start."
          const cachedRelease = yield* cacheManager
            .get<AppReleaseInfo>(ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY)
            .pipe(Effect.orElseSucceed(() => null));
          const previousAppRelease = toAppReleaseInfo(cachedRelease?.value);

          const additions: QueuedAnalyticsEvent[] = [];
          if (!previousAppRelease) {
            additions.push(createQueuedAnalyticsEvent("app_installed", {}));
          } else if (
            previousAppRelease.appBuild !== currentAppRelease.appBuild ||
            previousAppRelease.appVersion !== currentAppRelease.appVersion
          ) {
            additions.push(createQueuedAnalyticsEvent("app_updated", {}));
          }
          additions.push(createQueuedAnalyticsEvent("app_opened", {}));

          queueRef.ref.current = [...queueRef.ref.current, ...additions];

          yield* cacheManager
            .set(
              ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY,
              currentAppRelease
            )
            .pipe(Effect.orElseSucceed(() => undefined));
        });

      // Background flush daemon: wakes on either the 5s tick or a threshold
      // signal from `capture`, then fires the registered callback so the outer
      // wrapper can route the flush through its single-flight guard. Forked
      // into the service scope — interrupted automatically on runtime dispose.
      const daemon = Effect.forever(
        Effect.gen(function* () {
          yield* Effect.race(
            Effect.sleep(Duration.millis(ANALYTICS_FLUSH_INTERVAL_MS)),
            latch.await
          );
          yield* latch.close;
          yield* Effect.sync(() => flushCallback?.());
        })
      );
      yield* Effect.forkScoped(daemon);

      return {
        capture,
        captureAutomaticStartupEvents,
        flush,
        getQueueLength: () => queueRef.ref.current.length,
        getStandardizedProperties: () => getStandardizedProperties(),
        sendAnalyticsEvents,
        setFlushCallback: (cb: () => void) => {
          flushCallback = cb;
        },
        transferEvents,
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make);
}
