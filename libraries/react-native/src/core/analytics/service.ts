import * as P from "effect/Predicate";
import { make as makeEventCaptureClient } from "@voidhash/generated-clients/event-capture";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Str from "effect/String";
import * as Context from "effect/Context";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { CacheManager } from "../caching/cache-manager";
import { IdentityManager } from "../identity/identity-manager";
import { SdkConfiguration } from "../sdk-configuration";
import { getNonce } from "../utils/crypto";
import { AUTOMATIC_EVENTS } from "./constants";
import { AnalyticsIngestEvent, AnalyticsSendFailure, QueuedAnalyticsEvent } from "./types";
import {
  createQueuedAnalyticsEvent,
  getAnalyticsStandardizedProperties,
  mapQueuedAnalyticsEventToIngestEvent,
} from "./utils";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const ANALYTICS_BATCH_SIZE = 20;
const ANALYTICS_FLUSH_INTERVAL_MS = 5000;
const MAX_ANALYTICS_RETRY_DELAY_MS = 30_000;
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

const getAnalyticsRetryDelayMs = (attempts: number) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), MAX_ANALYTICS_RETRY_DELAY_MS);

const parseRetryAfterMs = (value: string, now: number): Option.Option<number> => {
  const retryAfterSeconds = Number(value);
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Option.some(Math.ceil(retryAfterSeconds * 1000));
  }

  return Option.map(DateTime.make(value), (retryAt) =>
    Math.max(DateTime.toEpochMillis(retryAt) - now, 0),
  );
};

/**
 * Inline retry schedule used inside `flush()`: exponential backoff capped at 3
 * total attempts. Retry-After-bearing failures are excluded via the `while`
 * predicate so they're postponed in the queue instead — preserving the
 * cool-down behavior expected by the rate-limit tests.
 */
const inlineRetrySchedule = Schedule.exponential(Duration.seconds(1), 2).pipe(
  Schedule.upTo({ times: 2 }),
);

/**
 * Owns the analytics pipeline: an in-memory event queue with batching, a
 * declarative retry schedule, `Retry-After` honouring, automatic startup
 * events (`$app_installed` / `$app_updated` / `$app_opened`), and a periodic
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
      const getStandardizedProperties = yield* Effect.cached(getAnalyticsStandardizedProperties);
      const flushCallbackRef = MutableRef.make(Option.none<() => void>());

      // The ingest endpoint lives on the same host as the API but under the
      // `/i/v1/...` path prefix. The generated client owns the path, so we
      // only need to inject the base origin via `prependUrl`. `ingestUrl`
      // remains as an override for local/test ingest servers.
      const ingestBaseUrl = sdkConfiguration.ingestUrl ?? sdkConfiguration.baseUrl;
      const eventCaptureClient = makeEventCaptureClient(httpClient, {
        transformClient: (client) =>
          Effect.succeed(
            client.pipe(
              HttpClient.mapRequest((request) =>
                HttpClientRequest.prependUrl(request, ingestBaseUrl),
              ),
            ),
          ),
      });

      const failNonRetryable = (status: number) =>
        Effect.fail(
          new AnalyticsSendFailure({
            message: `Analytics ingest request failed: ${status}`,
            retryable: false,
            status,
          }),
        );

      const failRetryable = (status: number, retryAfterMs?: number) =>
        Effect.fail(
          new AnalyticsSendFailure({
            message: `Analytics ingest request failed: ${status}`,
            retryAfterMs,
            retryable: true,
            status,
          }),
        );

      const sendAnalyticsEvents = Effect.fn("AnalyticsService.sendAnalyticsEvents")(
        function* (events: ReadonlyArray<AnalyticsIngestEvent>) {
          if (Arr.isReadonlyArrayEmpty(events)) return;

          const distinctId = yield* identityManager.getDistinctId();
          const sentAt = yield* DateTime.now;
          yield* eventCaptureClient.eventCaptureBatch({
            payload: {
              events: events.map((event) => ({
                context: event.context,
                distinct_id: distinctId,
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
          });
        },
        Effect.catchTags({
          CaptureDependencyUnavailableError: (err) => failRetryable(err.response.status),
          CaptureInternalServerError: (err) => failRetryable(err.response.status),
          // The 400 is now a typed contract error rather than an untagged
          // `EventCaptureBatch400`.
          CaptureInvalidRequestError: (err) => failNonRetryable(err.response.status),
          CapturePayloadTooLargeError: (err) => failNonRetryable(err.response.status),
          CaptureRateLimitedError: (err) =>
            Effect.fn("AnalyticsService.handleRateLimit")(function* () {
              const now = yield* Clock.currentTimeMillis;
              const headerDelay = Option.flatMap(
                Option.fromNullishOr(err.response.headers["retry-after"]),
                (value) => parseRetryAfterMs(value, now),
              );
              return yield* failRetryable(
                err.response.status,
                Option.getOrUndefined(
                  Option.orElse(headerDelay, () => Option.fromNullishOr(err.data.retry_after_ms)),
                ),
              );
            })(),
          CaptureUnauthorizedError: (err) => failNonRetryable(err.response.status),
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
            : failNonRetryable(status);
        }),
      );

      // Inline retry wrapper used by the queue-draining `flush()` path. Public
      // `sendAnalyticsEvents` stays single-shot so callers can implement their
      // own retry strategy.
      const sendWithInlineRetry = (events: ReadonlyArray<AnalyticsIngestEvent>) =>
        sendAnalyticsEvents(events).pipe(
          Effect.retry({
            schedule: inlineRetrySchedule,
            while: (failure: AnalyticsSendFailure) =>
              failure.retryable && failure.retryAfterMs === undefined,
          }),
        );

      // Re-inserts a failed batch at the head of the queue with bumped
      // `availableAt` so the next due-check skips it until cool-down has
      // elapsed. Used only on retryable failures — successful sends and
      // non-retryable drops simply leave the events out of the queue, since
      // `takeDueBatch` already removed them.
      const postponeQueuedBatch = (
        events: ReadonlyArray<QueuedAnalyticsEvent>,
        nextAvailableAt: number,
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
          return [batch, queue.slice(batch.length)];
        });

      const processQueuedBatch: (
        queuedBatch: ReadonlyArray<QueuedAnalyticsEvent>,
        standardizedProperties: Record<string, unknown>,
      ) => Effect.Effect<void> = Effect.fn("AnalyticsService.processQueuedBatch")(function* (
        queuedBatch: ReadonlyArray<QueuedAnalyticsEvent>,
        standardizedProperties: Record<string, unknown>,
      ) {
        const ingestBatch = queuedBatch.map((event) =>
          mapQueuedAnalyticsEventToIngestEvent(event, standardizedProperties, sessionId),
        );

        yield* sendWithInlineRetry(ingestBatch).pipe(
          Effect.catchTag("AnalyticsSendFailure", (failure) => {
            if (failure.status === 413 && queuedBatch.length > 1) {
              const midpoint = Math.ceil(queuedBatch.length / 2);
              return Effect.fn("AnalyticsService.splitOversizedBatch")(function* () {
                yield* processQueuedBatch(queuedBatch.slice(0, midpoint), standardizedProperties);
                yield* processQueuedBatch(queuedBatch.slice(midpoint), standardizedProperties);
              })();
            }

            if (failure.status === 413) {
              return Effect.logWarning("Dropping analytics event after 413 response", {
                eventId: queuedBatch[0]?.id,
              });
            }

            if (failure.retryable) {
              return Effect.fn("AnalyticsService.postponeFailedBatch")(function* () {
                const now = yield* Clock.currentTimeMillis;
                const delayMs =
                  failure.retryAfterMs ??
                  getAnalyticsRetryDelayMs((queuedBatch[0]?.attempts ?? 0) + 1);
                yield* postponeQueuedBatch(queuedBatch, now + delayMs);
              })();
            }

            return Effect.logWarning("Dropping analytics batch after non-retryable response", {
              eventIds: queuedBatch.map((event) => event.id),
              status: failure.status,
            });
          }),
        );
      });

      const capture = Effect.fn("AnalyticsService.capture")(function* (
        eventName: string,
        properties: Record<string, unknown> = {},
      ) {
        const normalized = eventName.trim();
        if (!normalized) return;
        const queued = yield* createQueuedAnalyticsEvent(normalized, properties);
        const next = yield* Ref.updateAndGet(queueRef, (queue) => [...queue, queued]);
        if (next.length >= ANALYTICS_BATCH_SIZE) {
          // Wake the flush daemon immediately rather than waiting for the tick.
          latch.openUnsafe();
          Option.getOrElse(MutableRef.get(flushCallbackRef), () => () => undefined)();
        }
      });

      const flush = Effect.fn("AnalyticsService.flush")(function* () {
        const standardizedProperties = yield* getStandardizedProperties;

        const drain: () => Effect.Effect<void> = Effect.fn("AnalyticsService.drainQueue")(
          function* () {
            const now = yield* Clock.currentTimeMillis;
            const batch = yield* takeDueBatch(now);
            if (Arr.isReadonlyArrayEmpty(batch)) return;
            yield* processQueuedBatch(batch, standardizedProperties);
            yield* drain();
          },
        );
        yield* drain();
      });

      const transferEvents = Effect.fn("AnalyticsService.transferEvents")(function* (
        events: ReadonlyArray<{
          eventName: string;
          properties: Record<string, unknown>;
        }>,
      ) {
        const additions = yield* Effect.forEach(
          events.filter((event) => Str.isNonEmpty(event.eventName.trim())),
          (event) => createQueuedAnalyticsEvent(event.eventName.trim(), event.properties),
          { concurrency: 1 },
        );
        if (Arr.isReadonlyArrayEmpty(additions)) return;
        yield* Ref.update(queueRef, (queue) => [...queue, ...additions]);
      });

      const captureAutomaticStartupEvents = Effect.fn(
        "AnalyticsService.captureAutomaticStartupEvents",
      )(function* () {
        const standardizedProps = yield* getStandardizedProperties;
        const currentAppRelease: AppReleaseInfo = {
          appBuild: toReleaseString(standardizedProps.$app_build),
          appVersion: toReleaseString(standardizedProps.$app_version),
        };

        // If reading the cached release fails, fall back to recording the
        // session as a fresh `$app_opened`. Captures still flow through the
        // same queue so the failure mode is "lose the install/update event,"
        // not "drop the session start."
        const cachedRelease = yield* cacheManager
          .get<AppReleaseInfo>(ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY)
          .pipe(Effect.orElseSucceed(() => Option.none()));
        const previousAppRelease = Option.map(cachedRelease, (hit) => hit.value);
        const releaseEvent = Option.match(previousAppRelease, {
          onNone: () => Option.some(AUTOMATIC_EVENTS.APP_INSTALLED),
          onSome: (previous) =>
            previous.appBuild !== currentAppRelease.appBuild ||
            previous.appVersion !== currentAppRelease.appVersion
              ? Option.some(AUTOMATIC_EVENTS.APP_UPDATED)
              : Option.none(),
        });
        const eventNames = Option.match(releaseEvent, {
          onNone: () => [AUTOMATIC_EVENTS.APP_OPENED],
          onSome: (eventName) => [eventName, AUTOMATIC_EVENTS.APP_OPENED],
        });
        const additions = yield* Effect.forEach(
          eventNames,
          (eventName) => createQueuedAnalyticsEvent(eventName, {}),
          { concurrency: 1 },
        );
        yield* Ref.update(queueRef, (queue) => [...queue, ...additions]);

        yield* cacheManager
          .set(ANALYTICS_LAST_SEEN_APP_RELEASE_STORAGE_KEY, currentAppRelease)
          .pipe(Effect.orElseSucceed(() => undefined));
      });

      // Background flush daemon: wakes on either the 5s tick or a threshold
      // signal from `capture`, then fires the registered callback so the outer
      // wrapper can route the flush through its single-flight guard. Forked
      // into the service scope — interrupted automatically on runtime dispose.
      const daemon = Effect.forever(
        Effect.fn("AnalyticsService.flushDaemonTick")(function* () {
          yield* Effect.race(
            Effect.sleep(Duration.millis(ANALYTICS_FLUSH_INTERVAL_MS)),
            latch.await,
          );
          yield* latch.close;
          yield* Effect.sync(() =>
            Option.getOrElse(MutableRef.get(flushCallbackRef), () => () => undefined)(),
          );
        })(),
      );
      yield* Effect.forkScoped(daemon);

      return {
        capture,
        captureAutomaticStartupEvents,
        flush,
        getQueueLength: () => queueRef.ref.current.length,
        getStandardizedProperties: () => getStandardizedProperties,
        sendAnalyticsEvents,
        setFlushCallback: (cb: () => void) => {
          MutableRef.set(flushCallbackRef, Option.some(cb));
        },
        transferEvents,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
