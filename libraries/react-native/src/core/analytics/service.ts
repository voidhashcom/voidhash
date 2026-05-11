import {
  Duration,
  Effect,
  Latch,
  Layer,
  Ref,
  Schedule,
  ServiceMap,
} from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";

import { CacheManager } from "../caching/cache-manager";
import { SDK_VERSION } from "../constants";
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
const RETRYABLE_ANALYTICS_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
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

const getRetryAfterMsFromResponseBody = (
  data: unknown
): number | undefined => {
  if (
    data !== null &&
    typeof data === "object" &&
    "retry_after_ms" in data &&
    typeof (data as { retry_after_ms?: unknown }).retry_after_ms === "number"
  ) {
    return (data as { retry_after_ms: number }).retry_after_ms;
  }
  return undefined;
};

const resolveIngestEventsUrl = (options: {
  baseUrl: string;
  ingestUrl: string | undefined;
}) => {
  const baseUrl = options.ingestUrl
    ? new URL(options.ingestUrl)
    : buildDefaultIngestBaseUrl(options.baseUrl);
  return new URL("/batch", baseUrl).toString();
};

const buildDefaultIngestBaseUrl = (apiBaseUrl: string) => {
  const parsedApiUrl = new URL(apiBaseUrl);
  parsedApiUrl.hostname = `i.${parsedApiUrl.hostname}`;
  parsedApiUrl.hash = "";
  parsedApiUrl.pathname = "/";
  parsedApiUrl.search = "";
  return parsedApiUrl;
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
export class AnalyticsService extends ServiceMap.Service<AnalyticsService>()(
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

      const ingestEventsUrl = resolveIngestEventsUrl({
        baseUrl: sdkConfiguration.baseUrl,
        ingestUrl: sdkConfiguration.ingestUrl,
      });

      const buildRetryableFailure = (response: HttpClientResponse.HttpClientResponse) =>
        Effect.gen(function* () {
          const body = yield* response.json.pipe(
            Effect.orElseSucceed(() => undefined as unknown)
          );
          return yield* Effect.fail(
            new AnalyticsSendFailure({
              message: `Analytics ingest request failed: ${response.status}`,
              retryAfterMs:
                parseRetryAfterMs(response.headers["retry-after"]) ??
                getRetryAfterMsFromResponseBody(body),
              retryable: true,
              status: response.status,
            })
          );
        });

      const sendAnalyticsEvents = (
        events: ReadonlyArray<AnalyticsIngestEvent>
      ): Effect.Effect<void, AnalyticsSendFailure> =>
        Effect.gen(function* () {
          if (events.length === 0) return;

          const distinctId = yield* identityManager.getDistinctId();
          const request = HttpClientRequest.post(ingestEventsUrl).pipe(
            HttpClientRequest.bodyJsonUnsafe({
              events: events.map((event) => ({
                context: event.context,
                distinct_id: distinctId,
                event: event.event_name,
                properties: event.properties,
                request: {
                  sdk_name: "react-native",
                  sdk_version: SDK_VERSION,
                },
                session_id: event.session_id,
                timestamp: event.event_ts,
                uuid: event.event_id,
              })),
              sent_at: new Date().toISOString(),
              token: sdkConfiguration.publishableKey,
            })
          );

          const response = yield* httpClient.execute(request).pipe(
            Effect.catchTag("HttpClientError", (cause) =>
              Effect.fail(
                new AnalyticsSendFailure({
                  cause,
                  message: "Analytics request failed",
                  retryable: true,
                })
              )
            )
          );

          return yield* HttpClientResponse.matchStatus(response, {
            "2xx": () => Effect.void,
            413: () =>
              Effect.fail(
                new AnalyticsSendFailure({
                  message: `Analytics ingest request failed: ${response.status}`,
                  retryable: false,
                  status: response.status,
                })
              ),
            orElse: (res) =>
              RETRYABLE_ANALYTICS_STATUS_CODES.has(res.status)
                ? buildRetryableFailure(res)
                : Effect.fail(
                    new AnalyticsSendFailure({
                      message: `Analytics ingest request failed: ${res.status}`,
                      retryable: false,
                      status: res.status,
                    })
                  ),
          });
        });

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
