import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import type { CaptureAcceptedResponse } from "@voidhash/generated-clients/event-capture";

import type {
  AnalyticsConsent,
  AnalyticsFlushResult,
  AnalyticsFlushStatus,
  VoidhashAnalyticsEvent,
  VoidhashEventContext,
} from "../../types";
import { CacheAdapter } from "../caching/cache-adapter";
import { CacheManager } from "../caching/cache-manager";
import { Diagnostics } from "../diagnostics";
import { EventBusProvider } from "../event-bus";
import { IdentityManager } from "../identity/identity-manager";
import { AuthGate } from "../networking/auth-gate";
import { CircuitBreaker } from "../networking/circuit-breaker";
import { HttpTransport } from "../networking/http";
import {
  QUEUE_BACKOFF_CAP_MS,
  REQUEST_TIMEOUT_MS,
  backoffMs,
  breakerKey,
  countsTowardsBreaker,
  isAuthStatus,
  isRefusal,
  resolveRetryAfterMs,
} from "../networking/network-policy";
import { SingleFlight } from "../networking/single-flight";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";
import {
  AD_DATA_SHARING_REVOCATIONS_KEY,
  ANALYTICS_CONSENT_HEADER,
  ANALYTICS_CONSENT_IMPLIED_KEY,
  ANALYTICS_CONSENT_KEY,
  isAnalyticsConsent,
  AnalyticsConsentState,
} from "./analytics-consent";
import { GROUP_IDENTIFY_EVENT } from "../identity/identity-manager";
import { isJsonObject } from "../json";
import {
  createAnalyticsEvent,
  createEventId,
  isPlainObject,
  normalizeAnalyticsRecord,
} from "./analytics-context";
import { touchStateKey, writeTouchState } from "./attribution";
import { heldLockNames, holdQueueOwnerLock, isQueueOwnerAlive, withQueueLock } from "./queue-lock";
import type { AnalyticsRequestEvent, QueuedAnalyticsEvent } from "./contracts";

// Each tab owns one queue segment and is the only writer of that key, so two
// tabs appending at the same time can never overwrite each other's events. A
// segment left behind by a closed tab is adopted by a surviving tab under the
// maintenance lock.
// Every key the queue writes starts with this prefix, so revoking consent can
// clear them all, including segments of other tabs.
const ANALYTICS_KEY_PREFIX = "analytics:";
const QUEUE_SEGMENT_PREFIX = "analytics:queue:";
const QUEUE_OWNER_PREFIX = "analytics:owner:";
// Queue key used before segments existed; adopted once on first flush.
const SHARED_QUEUE_KEY = "analytics:queue";
const MAINTENANCE_LOCK_KEY = "vh:lock:analytics-flush";
const OWNER_LOCK_PREFIX = "vh:lock:analytics-owner:";
const FLUSH_SINGLE_FLIGHT_KEY = "analytics:flush";
const MAX_INGEST_BATCH_SIZE = 100;
/**
 * Batches one flush sends at most. A backlog drains over a few flush intervals
 * rather than in one burst: after an outage every client sends its backlog as
 * Voidhash comes back, which must not knock it over again.
 */
export const MAX_BATCHES_PER_FLUSH = 10;
/**
 * Most of the device's storage the queue may take, in UTF-16 code units,
 * counted over the segments of every tab. A browser gives a site about five
 * million for all of `localStorage`, the app's own data included, so a long
 * outage must not take it: events past this budget stay in memory for the page.
 */
export const QUEUE_STORAGE_BUDGET = 1_000_000;
/**
 * How often a backed-up queue is stored, rather than on every event: each
 * write copies the whole queue, and the browser hands the copy to every other
 * open tab of the site.
 */
export const QUEUE_PERSIST_INTERVAL_MS = 1_000;
/** Room for the cache envelope and namespace around a stored segment. */
const SEGMENT_OVERHEAD = 200;
/** How often evictions from a full queue are reported while they go on. */
const EVICTION_REPORT_INTERVAL_MS = 60_000;
/** How long a backed-up queue waits to try storage again after a refused write. */
export const STORAGE_RETRY_INTERVAL_MS = 60_000;
// Browsers cap `keepalive` request bodies at 64 KB; anything above is rejected
// outright, so the pagehide flush sends at most that much and leaves the rest.
const KEEPALIVE_MAX_BATCH_BYTES = 64 * 1024;
const ANALYTICS_SEND_FAILURE: { readonly _tag: "AnalyticsSendFailure" } = {
  _tag: "AnalyticsSendFailure",
};
const KEEPALIVE_SEND_FAILURE: { readonly _tag: "KeepaliveSendFailure" } = {
  _tag: "KeepaliveSendFailure",
};
const NOTHING_FLUSHED: AnalyticsFlushStatus = { flushed: 0, pending: 0 };
// Shared by every tab, and under the analytics prefix so revoking consent
// clears it with the queue.
const SESSION_KEY = "analytics:session";
/**
 * Inactivity window after which the next event starts a new session, the same
 * as in the iOS, Android and React Native SDKs.
 */
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
/**
 * How far a session's last activity may run ahead of its stored copy before an
 * event writes it again, so a stream of events does not rewrite storage each
 * time. It costs other tabs at most this much of the inactivity window.
 */
const SESSION_PERSIST_INTERVAL_MS = 30 * 1000;
/** Most events held for the consent answer; see `analyticsWhilePending`. */
export const MAX_BUFFERED_EVENTS = 100;

/** What `enqueue` takes besides an event's name and properties. */
interface EnqueueOptions {
  /** The page the event is about, when the visitor has moved on from it. */
  readonly context?: VoidhashEventContext;
  readonly eventId?: string;
  /** See {@link QueuedAnalyticsEvent.personWrite}. */
  readonly personWrite?: boolean;
  /** See {@link QueuedAnalyticsEvent.provisional}. */
  readonly provisional?: boolean;
  /**
   * The whole page context of an event that happened earlier, recorded in place
   * of the page the visitor is on now.
   */
  readonly recordedOn?: VoidhashEventContext;
  readonly sessionId?: string;
  readonly timestamp?: string;
}

interface AnalyticsSession {
  readonly id: string;
  /** Epoch milliseconds of the last event recorded in this session. */
  readonly lastEventAt: number;
}

const isAnalyticsSession = (value: unknown): value is AnalyticsSession =>
  P.hasProperty(value, "id") &&
  P.isString(value.id) &&
  P.hasProperty(value, "lastEventAt") &&
  P.isNumber(value.lastEventAt);

const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;

const estimateEventBytes = (event: QueuedAnalyticsEvent) =>
  byteLength(JSON.stringify(event.payload));

/**
 * Whether an event waits to be sent: its backoff is over, no `keepalive`
 * request of a page leaving may already have delivered it, and it is not the
 * provisional `$pageleave` of a page the visitor may return to.
 */
const isDue = (event: QueuedAnalyticsEvent, now: number) =>
  event.keepaliveSentAt === undefined && !event.provisional && event.availableAt <= now;

const buildIdSet = (events: ReadonlyArray<QueuedAnalyticsEvent>): ReadonlySet<string> =>
  new Set(events.map((event) => event.id));

/** An event as it is sent once the page it left is really gone. */
const withoutProvisional = ({ provisional: _provisional, ...event }: QueuedAnalyticsEvent) => event;

const optionalNumber = (value: unknown) => {
  if (P.isNumber(value)) {
    return value;
  }
  return undefined;
};

const isCaptureAcceptedResponse = (value: unknown): value is CaptureAcceptedResponse => {
  if (!isJsonObject(value)) {
    return false;
  }
  return P.isNumber(value.accepted) && P.isNumber(value.rejected);
};

/** The error code ingest means by a status, when its body does not say. */
const ERROR_CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: "invalid_request",
  401: "unauthorized",
  413: "payload_too_large",
  429: "rate_limited",
  500: "internal_error",
  503: "dependency_unavailable",
};

const extractCaptureError = (input: {
  data?: unknown;
  status: number;
}): Option.Option<{ code: string; retry_after_ms?: number }> => {
  if (isJsonObject(input.data) && P.isString(input.data.code)) {
    return Option.some({
      code: input.data.code,
      retry_after_ms: optionalNumber(input.data.retry_after_ms),
    });
  }

  return Option.map(Option.fromUndefinedOr(ERROR_CODE_BY_STATUS[input.status]), (code) => ({
    code,
  }));
};

export const makeAnalyticsService = Effect.fnUntraced(function* makeAnalyticsService() {
  const authGate = yield* AuthGate;
  const breaker = yield* CircuitBreaker;
  const cacheManager = yield* CacheManager;
  const config = yield* SdkConfiguration;
  const consent = yield* AnalyticsConsentState;
  const diagnostics = yield* Diagnostics;
  const eventBus = yield* EventBusProvider;
  const transport = yield* HttpTransport;
  const identityManager = yield* IdentityManager;
  const platform = yield* PlatformProvider;
  const cacheAdapter = yield* CacheAdapter;
  const singleFlight = yield* SingleFlight;

  const ingestBreakerKey = breakerKey("ingest", config.analytics.baseUrl);
  const isAppSource = config.analyticsConsentSource === "app";
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
  // Whether the client wants the flush ticker; it only runs while consent is granted.
  let isStarted = false;
  // The flush currently sending from this tab, so revoking consent can abort it.
  let inFlightFlush = Option.none<Fiber.Fiber<AnalyticsFlushStatus>>();
  let consentDiagnosticReported = false;
  let session = Option.none<AnalyticsSession>();
  let persistedSession = Option.none<AnalyticsSession>();
  // Whether this tab's queue outgrew what the storage budget leaves it, and
  // when the device last refused a write of it.
  let isOverStorageBudget = false;
  let storageRefusedAt = Option.none<number>();
  /** The events this tab's stored segment holds, as of its last write or load. */
  let storedIds: ReadonlySet<string> = new Set();
  /** Segments this tab is taking over, whose events its own write now holds. */
  let adoptedSegments: ReadonlySet<string> = new Set();
  // The write of a backed-up queue waiting for its interval.
  let pendingPersist = Option.none<Fiber.Fiber<void>>();
  /**
   * Events past the storage budget while sending is held for the app's
   * answer. Storage keeps the rest, which another tab may adopt meanwhile;
   * these exist only here, so no other tab can send them too.
   */
  let heldInMemory: ReadonlyArray<QueuedAnalyticsEvent> = [];
  /**
   * The other tabs of the site that run a client, and how many of them hold
   * a backlog, as last counted. A write reads these rather than counting:
   * browsers answer the lock query in a later task, and the write as the page
   * is hidden must finish inside the handler.
   */
  let otherLiveTabIds: ReadonlySet<string> = new Set();
  let otherLiveTabs = 0;
  let isRecountingLiveTabs = false;
  let liveTabsRecount = Option.none<Fiber.Fiber<void>>();
  let evictedSinceReport = 0;
  let lastEvictionReportAt = Option.none<number>();
  // Events Voidhash accepted from this tab, so a flush that stops waiting can
  // say how many it saw delivered.
  let acceptedCount = 0;
  /**
   * Events recorded while consent is `pending`, with `analyticsWhilePending:
   * "buffer"`, oldest first: what `enqueue` was given, with the time and the
   * page they happened on. In memory only, until the answer.
   */
  let buffered: Array<{
    readonly eventName: string;
    readonly options: EnqueueOptions;
    readonly properties?: Record<string, unknown>;
  }> = [];

  // Queue persistence. Only this tab ever writes `segmentKey`, but another tab
  // adopts it while this one holds it back, so a load reads storage itself.
  const loadQueue = (options?: { readonly refresh?: boolean }) =>
    Effect.gen(function* loadQueue() {
      if (isLoaded && !options?.refresh) return;
      const cached = yield* cacheManager.get<QueuedAnalyticsEvent[]>(segmentKey, {
        refresh: true,
      });
      const stored = Option.match(cached, {
        onNone: (): ReadonlyArray<QueuedAnalyticsEvent> => [],
        onSome: (hit) => hit.value,
      });
      storedIds = buildIdSet(stored);
      // Held in memory past the budget, so older than what storage kept. A
      // provisional `$pageleave` found here closed a page view that ended when
      // consent was held; the client measures a new one.
      events = [...heldInMemory.filter((event) => !storedIds.has(event.id)), ...stored].filter(
        (event) => !event.provisional,
      );
      heldInMemory = [];
      isLoaded = true;
    });

  /** Events per request as sent: the option, at most what ingest accepts. */
  const batchSize = Math.min(config.analytics.maxBatchSize, MAX_INGEST_BATCH_SIZE);

  /** More than one request's worth is queued, as during an outage. */
  const isBackedUp = () => events.length > batchSize;

  const isQueueSegment = (key: string) =>
    key === SHARED_QUEUE_KEY || key.startsWith(QUEUE_SEGMENT_PREFIX);

  /**
   * How many other tabs of the site run a client and hold a backlog in
   * storage now: the tabs of the owner locks held, or, without Web Locks, of
   * the owner markers, whose queue segment holds events. A tab that delivers
   * normally stores next to nothing and takes no share. A marker a crashed
   * tab left behind counts while its segment holds events, which only makes
   * the shares smaller.
   */
  const countOtherLiveTabs = () =>
    Effect.gen(function* countOtherLiveTabs() {
      const held = yield* heldLockNames();
      const otherTabs = Option.isSome(held)
        ? held.value
            .filter((name) => name.startsWith(OWNER_LOCK_PREFIX) && name !== ownerLockKey)
            .map((name) => name.slice(OWNER_LOCK_PREFIX.length))
        : (yield* cacheManager.getCacheKeys())
            .filter((key) => key.startsWith(QUEUE_OWNER_PREFIX) && key !== ownerKey)
            .map((key) => key.slice(QUEUE_OWNER_PREFIX.length));
      const stored = yield* Effect.forEach(
        otherTabs,
        (tab) => cacheManager.storedLength(`${QUEUE_SEGMENT_PREFIX}${tab}`),
        { concurrency: 1 },
      );
      return {
        ids: new Set(otherTabs),
        withBacklog: stored.filter((length) => length > SEGMENT_OVERHEAD).length,
      };
    });

  /** Counts the other live tabs now, for the writes that follow. */
  const countLiveTabs = () =>
    Effect.map(countOtherLiveTabs(), (others) => {
      otherLiveTabIds = others.ids;
      otherLiveTabs = others.withBacklog;
    });

  /**
   * Counts the other live tabs again in the background, one count at a time,
   * after a backed-up queue was stored or another tab stored its queue. When
   * the part this tab stored is over what it may take now, it is stored
   * again: tabs opened together each counted before the others had a backlog,
   * and a tab that filled the budget alone makes room for one that starts
   * after it.
   */
  const recountLiveTabs = (): Effect.Effect<void> =>
    Effect.gen(function* recountLiveTabs() {
      if (isRecountingLiveTabs) return;
      isRecountingLiveTabs = true;
      liveTabsRecount = Option.some(
        yield* Effect.forkDetach(
          Effect.gen(function* recount() {
            yield* countLiveTabs();
            if (!isBackedUp()) return;
            const room = yield* queueRoom();
            if ((yield* cacheManager.storedLength(segmentKey)) > room + SEGMENT_OVERHEAD) {
              yield* persistQueue();
            }
          }).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                isRecountingLiveTabs = false;
              }),
            ),
          ),
        ),
      );
    });

  /**
   * This tab's share of {@link QUEUE_STORAGE_BUDGET}: all of it for a tab on
   * its own, an equal part next to other live tabs with a backlog. A tab may
   * always take its share: one that took more before this one had a backlog
   * gives it back when it counts again. Tabs writing at the same moment
   * cannot see each other's writes yet, as a browser hands them over with a
   * delay, but they agree on how many tabs hold a backlog, so together they
   * keep within the budget.
   */
  const storageShare = () => QUEUE_STORAGE_BUDGET / (otherLiveTabs + 1);

  /** How many of the newest of `queued` fit in `room` characters. */
  const countNewestFitting = (queued: ReadonlyArray<QueuedAnalyticsEvent>, room: number) =>
    Arr.reduce(Arr.reverse(queued), { kept: 0, stopped: false, used: 0 }, (state, event) => {
      if (state.stopped) return state;
      const used = state.used + JSON.stringify(event).length + 1;
      return used > room
        ? { ...state, stopped: true }
        : { kept: state.kept + 1, stopped: false, used };
    }).kept;

  /**
   * What the other queue segments take on the device: those of the live tabs
   * last counted, and those closed pages left until a live tab takes them
   * over.
   */
  const measureOtherSegments = () =>
    Effect.gen(function* measureOtherSegments() {
      const keys = (yield* cacheManager.getCacheKeys()).filter(
        (key) => key !== segmentKey && isQueueSegment(key) && !adoptedSegments.has(key),
      );
      const measured = yield* Effect.forEach(
        keys,
        (key) =>
          Effect.map(cacheManager.storedLength(key), (length) => ({
            isLive: otherLiveTabIds.has(key.slice(QUEUE_SEGMENT_PREFIX.length)),
            length,
          })),
        { concurrency: 1 },
      );
      return Arr.reduce(measured, { leftBehind: 0, live: 0 }, (total, segment) =>
        segment.isLive
          ? { ...total, live: total.live + segment.length }
          : { ...total, leftBehind: total.leftBehind + segment.length },
      );
    });

  /**
   * The characters this tab's queue may take: what the other live tabs leave
   * of the budget, but at least its share, less what closed pages left until
   * it is taken over. Open tabs that hold a little reserve no more than that.
   */
  const queueRoom = () =>
    Effect.map(
      measureOtherSegments(),
      ({ leftBehind, live }) =>
        Math.max(storageShare(), QUEUE_STORAGE_BUDGET - live) - leftBehind - SEGMENT_OVERHEAD,
    );

  /**
   * The newest events that fit in what this tab's queue may take of the
   * storage; the oldest stay in memory only, as the queue cap drops the
   * oldest first. Measured on
   * every write: a backed-up queue is written at most once per
   * {@link QUEUE_PERSIST_INTERVAL_MS}, and the other tabs' share changes as
   * they queue and send. Reported once when events start to be kept in memory
   * only, and again after the queue fit in between.
   */
  const fitStorageBudget = () =>
    Effect.gen(function* fitStorageBudget() {
      const kept = countNewestFitting(events, yield* queueRoom());
      const unstored = events.slice(0, events.length - kept);
      if (Arr.isReadonlyArrayNonEmpty(unstored) && !isOverStorageBudget) {
        yield* diagnostics.report({
          code: "ANALYTICS_QUEUE_IN_MEMORY",
          kind: "cache",
          message: `The analytics queue reached its storage budget; its ${unstored.length} oldest event(s) are kept in memory only, and are lost if the page closes before they are sent.`,
          operation: "analytics.enqueue",
          retryable: true,
        });
      }
      isOverStorageBudget = Arr.isReadonlyArrayNonEmpty(unstored);
      return events.slice(events.length - kept);
    });

  const cancelPendingPersist = () =>
    Effect.suspend(() => {
      const pending = pendingPersist;
      pendingPersist = Option.none();
      return Option.match(pending, { onNone: () => Effect.void, onSome: Fiber.interrupt });
    });

  /**
   * Stores the queue. A queue that is delivered normally is small and stored
   * whole. A backed-up one stores what fits in the storage budget.
   *
   * When the device refuses the write, it is full. The copy an earlier write
   * left stays, as it is within the budget and the next page takes it over,
   * and a backed-up queue tries storage again only once per
   * {@link STORAGE_RETRY_INTERVAL_MS} rather than on every event, apart from
   * one more try as the page goes away.
   */
  const persistQueue = (options?: { readonly retryNow?: boolean }) =>
    Effect.gen(function* persistQueue() {
      // This write covers the one waiting for its interval.
      yield* cancelPendingPersist();
      // Without consent nothing reaches storage, even from work that was
      // already running when consent was revoked. A queue not loaded since it
      // was held is what storage already holds.
      if (consent.current() !== "granted" || !isLoaded) return;
      const now = yield* Clock.currentTimeMillis;
      if (!isBackedUp()) {
        isOverStorageBudget = false;
      } else if (
        !options?.retryNow &&
        Option.exists(storageRefusedAt, (at) => now - at < STORAGE_RETRY_INTERVAL_MS)
      ) {
        return;
      }
      const stored = isBackedUp() ? yield* fitStorageBudget() : events;
      if (isBackedUp()) yield* recountLiveTabs();
      if (yield* cacheManager.set(segmentKey, stored)) {
        storageRefusedAt = Option.none();
        storedIds = buildIdSet(stored);
        return;
      }
      storageRefusedAt = Option.some(now);
    });

  /**
   * Stores the queue after an event joined it: at once while it is delivered
   * normally, at most once per {@link QUEUE_PERSIST_INTERVAL_MS} while it is
   * backed up, as during an outage.
   */
  const persistAfterEnqueue = () =>
    Effect.gen(function* persistAfterEnqueue() {
      if (!isBackedUp()) return yield* persistQueue();
      if (Option.isSome(pendingPersist)) return;
      pendingPersist = Option.some(
        yield* Effect.forkDetach(
          Effect.andThen(Effect.sleep(QUEUE_PERSIST_INTERVAL_MS), () =>
            Effect.suspend(() => {
              pendingPersist = Option.none();
              return persistQueue();
            }),
          ),
        ),
      );
    });

  /**
   * Another tab stored its queue: with a backlog here, count the tabs with
   * one again, as this tab may now be over its share.
   */
  const otherQueueChanged = () =>
    Effect.suspend(() => (isBackedUp() ? recountLiveTabs() : Effect.void));

  /**
   * Stores what is not stored yet, as the page may be going away: a write
   * waiting for its interval, or one storage refused, which is tried once
   * more.
   */
  const persistPending = () =>
    Effect.suspend(() =>
      Option.isSome(pendingPersist) || Option.isSome(storageRefusedAt)
        ? persistQueue({ retryNow: true })
        : Effect.void,
    );

  const isOrphanSegment = (key: string) =>
    Effect.gen(function* isOrphanSegment() {
      if (key === SHARED_QUEUE_KEY) {
        return true;
      }
      const owner = key.slice(QUEUE_SEGMENT_PREFIX.length);
      const alive = yield* isQueueOwnerAlive(`${OWNER_LOCK_PREFIX}${owner}`);
      if (Option.isSome(alive)) return !alive.value;

      // A suspended page cannot prove it is alive. Without Web Locks, only the
      // owner marker removed by a clean shutdown proves the owner is gone.
      const marker = yield* cacheManager.get<number>(`${QUEUE_OWNER_PREFIX}${owner}`, {
        refresh: true,
      });
      return Option.isNone(marker);
    });

  /**
   * Takes over the events of one segment whose owner is gone. A closed page
   * queued them, so they go before this page's own. Returns whether it did;
   * the caller removes the segment once this tab stored them.
   */
  const adoptSegment = (key: string) =>
    Effect.gen(function* adoptSegment() {
      if (!(yield* isOrphanSegment(key))) return false;

      const segment = yield* cacheManager.get<QueuedAnalyticsEvent[]>(key, { refresh: true });
      const left = Option.match(segment, {
        onNone: (): ReadonlyArray<QueuedAnalyticsEvent> => [],
        onSome: (hit) => hit.value,
      });
      // The page that sent these with `keepalive` is gone, so nobody will see
      // whether they arrived. Browsers deliver such requests after the page
      // closes, so they count as delivered rather than being sent twice.
      // The page that queued a provisional `$pageleave` is gone without its
      // visitor returning, which makes it final.
      const orphaned = left
        .filter((event) => event.keepaliveSentAt === undefined)
        .map(withoutProvisional);
      const handedOver = left.length - orphaned.length;
      if (handedOver > 0) {
        yield* diagnostics.report({
          code: "KEEPALIVE_UNCONFIRMED",
          kind: "transport",
          message: `${handedOver} analytics event(s) a closed page sent while leaving were not confirmed; they are not sent again.`,
          operation: "analytics.flush",
          retryable: false,
        });
      }

      // Taken over before, when this tab could not store them, the segment
      // still holds them.
      const known = buildIdSet(events);
      events = [...orphaned.filter((event) => !known.has(event.id)), ...events];
      return true;
    });

  /**
   * Moves events left behind by closed tabs into this tab's queue, then
   * stores it as every write does: the queue cap drops the oldest, and what
   * is past this tab's share of the storage stays in memory. Runs under the
   * maintenance lock so two tabs cannot adopt the same segment.
   */
  const adoptOrphanSegments = () =>
    Effect.gen(function* adoptOrphanSegments() {
      const keys = yield* cacheManager.getCacheKeys();
      const candidates = keys.filter((key) => key !== segmentKey && isQueueSegment(key));
      if (Arr.isReadonlyArrayEmpty(candidates)) return;

      yield* countLiveTabs();
      const adopted = yield* Effect.filter(candidates, adoptSegment, { concurrency: 1 });
      if (Arr.isReadonlyArrayEmpty(adopted)) return;
      yield* enforceQueueCap();
      const removeAdopted = Effect.forEach(
        adopted,
        (key) =>
          Effect.andThen(
            cacheManager.delete(key),
            key === SHARED_QUEUE_KEY
              ? Effect.void
              : cacheManager.delete(
                  `${QUEUE_OWNER_PREFIX}${key.slice(QUEUE_SEGMENT_PREFIX.length)}`,
                ),
          ),
        { concurrency: 1, discard: true },
      );
      // Their events are this tab's now: stored here first, while the
      // segments still hold them, and the segments go after. When storage
      // cannot hold both copies, the segments go first and the write is
      // tried once more. Either way none is taken over again, which would
      // send events already delivered once more.
      adoptedSegments = new Set(adopted);
      yield* Effect.ensuring(
        Effect.gen(function* storeAdopted() {
          yield* persistQueue();
          const isStored = Option.isNone(storageRefusedAt);
          yield* removeAdopted;
          if (!isStored) yield* persistQueue({ retryNow: true });
        }),
        Effect.sync(() => {
          adoptedSegments = new Set();
        }),
      );
    });

  // Queue operations
  /** Reports the evictions not reported yet, with how many there were. */
  const reportEvictions = () =>
    Effect.gen(function* reportEvictions() {
      if (evictedSinceReport === 0) return;
      lastEvictionReportAt = Option.some(yield* Clock.currentTimeMillis);
      const message = `Dropped ${evictedSinceReport} analytics event(s) because the queue is full.`;
      evictedSinceReport = 0;
      eventBus.emit("error", { message, source: "analytics" });
      yield* diagnostics.report({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message,
        operation: "analytics.enqueue",
        retryable: false,
      });
    });

  /**
   * Counts events evicted for a newer one. A full queue evicts one event per
   * new one, so the evictions are reported when they start and then at most
   * once per {@link EVICTION_REPORT_INTERVAL_MS}; the rest are reported once
   * delivery resumes or the client stops.
   */
  const countEvictions = (droppedCount: number) =>
    Effect.gen(function* countEvictions() {
      evictedSinceReport += droppedCount;
      const now = yield* Clock.currentTimeMillis;
      if (Option.exists(lastEvictionReportAt, (at) => now - at < EVICTION_REPORT_INTERVAL_MS)) {
        return;
      }
      yield* reportEvictions();
    });

  /** Trims the queue to its cap, evicting the oldest events first. */
  const enforceQueueCap = () =>
    Effect.gen(function* enforceQueueCap() {
      const droppedCount = Math.max(events.length - config.analytics.maxQueueSize, 0);
      if (droppedCount === 0) return;

      events.splice(0, droppedCount);
      yield* countEvictions(droppedCount);
    });

  const dropEvents = (ids: ReadonlySet<string>) => {
    events = events.filter((event) => !ids.has(event.id));
  };

  /** Marks events as handed to a `keepalive` request at `sentAt`. */
  const markKeepalive = (ids: ReadonlySet<string>, sentAt: number) => {
    events = events.map((event) =>
      ids.has(event.id) ? { ...event, keepaliveSentAt: sentAt } : event,
    );
  };

  /** Makes events handed to a `keepalive` request that failed wait to be sent again. */
  const unmarkKeepalive = (ids: ReadonlySet<string>) => {
    events = events.map((event) => {
      if (!ids.has(event.id)) return event;
      const { keepaliveSentAt: _sentAt, ...unmarked } = event;
      return unmarked;
    });
  };

  const postponeEvents = (ids: ReadonlySet<string>, nextAvailableAt: number) => {
    events = events.map((event) => {
      if (!ids.has(event.id)) return event;
      return { ...event, attempts: event.attempts + 1, availableAt: nextAvailableAt };
    });
  };

  // Events a regular flush is sending right now, which the `pagehide` flush
  // leaves out rather than sending them a second time.
  const sending = new Set<string>();

  const peekBatch = (input: {
    maxBatchBytes: number;
    maxBatchSize: number;
    now: number;
    leaveOutSending?: boolean;
  }) => {
    const dueEvents = events.filter(
      (event) => isDue(event, input.now) && !(input.leaveOutSending && sending.has(event.id)),
    );
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

  const buildBatchRequest = (
    batchEvents: ReadonlyArray<AnalyticsRequestEvent>,
    options?: { readonly keepalive?: boolean },
  ) =>
    Effect.map(Clock.currentTimeMillis, (sentAt) => {
      // A batch built just before consent was revoked tells ingest to reject it.
      const current = consent.current();
      return {
        // Appended to the base URL, so a first-party proxy mounted under a
        // path (`https://example.com/vh`) keeps its prefix.
        baseUrl: config.analytics.baseUrl,
        body: {
          events: batchEvents,
          // oxlint-disable-next-line effect/use-clock-service -- formats the time read from the Clock service.
          sent_at: new Date(sentAt).toISOString(),
          token: config.publishableKey,
        },
        // The JSON is sent as `text/plain`, which ingest reads as JSON: without
        // custom headers, a cross-origin batch then needs no preflight request,
        // a round trip the `keepalive` send of a closing page can least afford.
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          ...(current === "granted" ? {} : { [ANALYTICS_CONSENT_HEADER]: current }),
        },
        keepalive: options?.keepalive,
        method: "POST" as const,
        path: "/i/v1/batch",
      };
    });

  const sendBatchViaClient = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.gen(function* sendBatchViaClient() {
      const response = yield* transport.send(yield* buildBatchRequest(batchEvents));
      return {
        data: Option.getOrUndefined(response.json),
        headers: response.headers,
        status: response.status,
      };
    }).pipe(
      Effect.timeout(REQUEST_TIMEOUT_MS),
      Effect.mapError(() => ANALYTICS_SEND_FAILURE),
    );

  // Best-effort delivery on pagehide: `keepalive` lets the browser finish the
  // request after the document is gone.
  const sendBatchKeepalive = (batchEvents: ReadonlyArray<AnalyticsRequestEvent>) =>
    Effect.gen(function* sendBatchKeepalive() {
      return yield* transport.send(yield* buildBatchRequest(batchEvents, { keepalive: true }));
    }).pipe(
      Effect.timeout(REQUEST_TIMEOUT_MS),
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
    ids: ReadonlySet<string>,
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
    ids: ReadonlySet<string>,
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

      // The page is going away and may be gone before ingest answers. When
      // the request is expected to arrive, the events are marked as handed
      // to the browser before it starts, so the page that adopts this queue
      // does not send them again; they are sent again only if this page sees
      // the request fail. When it may well not arrive (offline, a browser
      // that drops `keepalive` requests with the page, ingest failing or
      // asking to wait), they are not marked: a repeat beats a loss.
      if (options?.keepalive) {
        const isExpectedToArrive =
          platform.isOnline() &&
          platform.supportsKeepalive() &&
          breaker.isHealthy(ingestBreakerKey) &&
          batch.every((event) => event.attempts === 0);
        if (isExpectedToArrive) {
          markKeepalive(ids, yield* Clock.currentTimeMillis);
          yield* persistQueue();
        }
        const result = yield* Effect.exit(sendBatchKeepalive(batchPayloads));
        if (Exit.isSuccess(result) && result.value.status === 202) {
          dropEvents(ids);
        } else {
          unmarkKeepalive(ids);
        }
        yield* persistQueue();
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

      Arr.forEach(batch, (event) => sending.add(event.id));
      const result = yield* Effect.exit(sendBatchViaClient(batchPayloads)).pipe(
        Effect.ensuring(Effect.sync(() => Arr.forEach(batch, (event) => sending.delete(event.id)))),
      );

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
          acceptedCount += capture.accepted;
          yield* reportEvictions();
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

        // Voidhash's verdict about the payload: a 4xx carrying its error.
        // Retrying cannot change it and the batch would block the head of
        // the queue forever, so it is dropped with a diagnostic.
        if (isRefusal(status, result.value.data, "ingest")) {
          yield* dropBatch(batch, ids, status);
          return Option.none();
        }

        // Anything else, every 5xx included, says nothing about the batch: a
        // proxy in front of an unreachable origin answers 520–530, and a
        // misconfigured one a 4xx without Voidhash's error.
        if (countsTowardsBreaker(status, result.value.data, "ingest")) {
          yield* breaker.recordFailure(ingestBreakerKey, "analytics.flush", true);
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

      yield* breaker.recordFailure(ingestBreakerKey, "analytics.flush", false);
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

  /**
   * Whether analytics consent allows `operation` to record anything. A skip is
   * reported once per period without consent.
   */
  const permits = (operation: string) =>
    Effect.gen(function* permits() {
      // A pause is the app's own decision, so it is not reported.
      if (consent.isPaused()) return false;
      if (consent.current() === "granted") return true;
      if (!consentDiagnosticReported) {
        consentDiagnosticReported = true;
        yield* diagnostics.report({
          code: "ANALYTICS_CONSENT_DENIED",
          kind: "consent",
          message: "Analytics consent is not granted; analytics events are not recorded.",
          operation,
          retryable: false,
        });
      }
      return false;
    });

  const persistSession = (next: AnalyticsSession) =>
    Effect.gen(function* persistSession() {
      session = Option.some(next);
      if (consent.current() !== "granted") return;
      yield* cacheManager.set(SESSION_KEY, next);
      persistedSession = session;
    });

  /**
   * The session that is still active at `now`: the most recent of this tab's
   * copy and the one other tabs stored, unless it has been inactive longer
   * than {@link SESSION_INACTIVITY_TIMEOUT_MS}.
   */
  const findActiveSession = (now: number) =>
    Effect.map(cacheManager.get<unknown>(SESSION_KEY, { refresh: true }), (stored) => {
      const candidates = [
        session,
        Option.filter(
          Option.map(stored, (hit) => hit.value),
          isAnalyticsSession,
        ),
      ];
      return Option.filter(
        Arr.reduce(candidates, Option.none<AnalyticsSession>(), (latest, candidate) =>
          Option.isSome(candidate) &&
          (Option.isNone(latest) || candidate.value.lastEventAt > latest.value.lastEventAt)
            ? candidate
            : latest,
        ),
        (candidate) => now - candidate.lastEventAt <= SESSION_INACTIVITY_TIMEOUT_MS,
      );
    });

  /**
   * The session an event at `now` joins: the active one, or a new one. A
   * session is a run of events with no gap longer than
   * {@link SESSION_INACTIVITY_TIMEOUT_MS}; every tab shares it through storage,
   * once {@link recordSessionActivity} records the event.
   */
  const sessionAt = (now: number) =>
    Effect.map(findActiveSession(now), (active): AnalyticsSession => ({
      id: Option.match(active, {
        onNone: () => platform.randomId(),
        onSome: (value) => value.id,
      }),
      lastEventAt: Math.max(
        now,
        Option.match(active, { onNone: () => 0, onSome: (value) => value.lastEventAt }),
      ),
    }));

  /** Records an event queued in `next`, the session {@link sessionAt} returned. */
  const recordSessionActivity = (next: AnalyticsSession) =>
    Effect.gen(function* recordSessionActivity() {
      const isUpToDate = Option.exists(
        persistedSession,
        (stored) =>
          stored.id === next.id &&
          next.lastEventAt - stored.lastEventAt < SESSION_PERSIST_INTERVAL_MS,
      );
      if (isUpToDate) {
        session = Option.some(next);
      } else {
        yield* persistSession(next);
      }
    });

  /**
   * The id of the session the next event joins, without extending it. None
   * when no session is active: nothing was recorded in the last
   * {@link SESSION_INACTIVITY_TIMEOUT_MS}, or analytics consent is not granted.
   */
  const getSessionId = () =>
    Effect.gen(function* getSessionId() {
      if (consent.current() !== "granted") return Option.none<string>();
      const active = yield* findActiveSession(yield* Clock.currentTimeMillis);
      return Option.map(active, (value) => value.id);
    });

  /** Starts a new session at once, as `reset()` does for the next end user. */
  const rotateSession = () =>
    Effect.gen(function* rotateSession() {
      const now = yield* Clock.currentTimeMillis;
      yield* persistSession({ id: platform.randomId(), lastEventAt: now });
    });

  /**
   * The session this tab last recorded in, however long ago: the one a
   * `$pageleave` joins. Leaving a page is no activity, so it neither extends a
   * session nor, from a tab closed an hour later, starts one of its own.
   */
  const lastSessionId = () => Option.getOrUndefined(session)?.id;

  /**
   * Reports a failure of a function the app configured, which the SDK
   * contained by recording less, never more.
   */
  const reportHookFailure = (input: {
    readonly code: string;
    readonly error: unknown;
    readonly message: string;
  }) =>
    Effect.gen(function* reportHookFailure() {
      eventBus.emit("error", { error: input.error, message: input.message, source: "analytics" });
      yield* diagnostics.report({
        code: input.code,
        kind: "eviction",
        message: input.message,
        operation: "analytics.enqueue",
        retryable: false,
      });
    });

  /**
   * The address `analytics.sanitizeUrl` lets the SDK record in place of
   * `url`. None when it keeps the address out, returns something that is not
   * an address, or throws.
   */
  const sanitizeUrl = (url: Option.Option<URL>) =>
    Effect.gen(function* sanitizeUrl() {
      const sanitize = config.analytics.sanitizeUrl;
      if (Option.isNone(url) || sanitize === undefined) return url;
      const sanitized = Result.try({ try: () => sanitize(url.value), catch: (error) => error });
      if (Result.isFailure(sanitized)) {
        yield* reportHookFailure({
          code: "SANITIZE_URL_FAILED",
          error: sanitized.failure,
          message: "analytics.sanitizeUrl threw, so the address was not recorded.",
        });
        return Option.none<URL>();
      }
      const { success } = sanitized;
      if (success instanceof URL) return Option.some(success);
      // A blank string would read as the page's own address.
      if (!P.isString(success) || success.trim() === "") return Option.none<URL>();
      return Option.liftThrowable(() => new URL(success, url.value))();
    });

  /**
   * The page and referrer addresses the SDK may record, after
   * `analytics.sanitizeUrl`. A page without an address is private.
   */
  const readPage = () =>
    Effect.gen(function* readPage() {
      return {
        referrerUrl: yield* sanitizeUrl(platform.getReferrerUrl()),
        url: yield* sanitizeUrl(platform.getCurrentUrl()),
      };
    });

  /**
   * Runs `analytics.beforeSend` on an event built with `context`. None when a
   * function drops the event or throws; otherwise the event with the
   * properties and context it returned, made JSON again.
   */
  const applyBeforeSend = (event: AnalyticsRequestEvent, context: VoidhashEventContext) =>
    Effect.gen(function* applyBeforeSend() {
      if (Arr.isReadonlyArrayEmpty(config.analytics.beforeSend)) return Option.some(event);
      const initial: VoidhashAnalyticsEvent = {
        context: { ...context },
        distinctId: event.distinct_id,
        event: event.event,
        eventId: event.uuid,
        properties: event.properties ?? {},
        ...(P.isString(event.session_id) && { sessionId: event.session_id }),
        timestamp: event.timestamp ?? "",
      };
      const outcome = Result.try({
        try: () =>
          Arr.reduce(config.analytics.beforeSend, Option.some(initial), (kept, hook) =>
            // After something else than an event, the remaining ones do not run.
            Option.flatMap(kept, (value) =>
              isPlainObject(value) ? Option.fromNullishOr(hook(value)) : kept,
            ),
          ),
        catch: (error) => error,
      });
      // `null`, or nothing after a forgotten `return`, drops the event.
      // Anything else that is not an event, such as the promise of an async
      // function, is a mistake, reported like a function that throws.
      const isMistake =
        Result.isSuccess(outcome) && Option.exists(outcome.success, (kept) => !isPlainObject(kept));
      if (Result.isFailure(outcome) || isMistake) {
        yield* reportHookFailure({
          code: "BEFORE_SEND_FAILED",
          error: Result.isFailure(outcome)
            ? outcome.failure
            : new TypeError("beforeSend must return an event or null."),
          message: `analytics.beforeSend failed, so the ${event.event} event was dropped.`,
        });
        return Option.none<AnalyticsRequestEvent>();
      }
      return Option.map(outcome.success, (kept) => ({
        ...event,
        context: isPlainObject(kept.context) ? normalizeAnalyticsRecord(kept.context) : {},
        properties: isPlainObject(kept.properties) ? normalizeAnalyticsRecord(kept.properties) : {},
      }));
    });

  /**
   * An event's properties with the groups the end user belongs to as `$groups`, where a group
   * the event names itself wins for its type. A `$groupidentify` gets none: it describes a group,
   * not something the end user did.
   */
  const withGroups = (eventName: string, properties?: Record<string, unknown>) => {
    const groups = identityManager.getGroups();
    if (eventName === GROUP_IDENTIFY_EVENT || R.isEmptyRecord(groups)) {
      return properties;
    }
    const own = properties?.$groups;
    return { ...properties, $groups: { ...groups, ...(isJsonObject(own) ? own : {}) } };
  };

  // Public API
  /**
   * Holds an event for the consent answer, with the time and the page it
   * happened on, as the visitor may have moved on by then. Past
   * {@link MAX_BUFFERED_EVENTS} the oldest gives way.
   */
  const buffer = (
    eventName: string,
    properties?: Record<string, unknown>,
    options?: EnqueueOptions,
  ) =>
    Effect.gen(function* buffer() {
      const now = yield* Clock.currentTimeMillis;
      buffered.push({
        eventName,
        options: {
          ...options,
          recordedOn: {
            ...platform.buildAnalyticsContext(yield* readPage()),
            ...options?.context,
          },
          // oxlint-disable-next-line effect/use-clock-service -- formats the time read from the Clock service.
          timestamp: options?.timestamp ?? new Date(now).toISOString(),
        },
        properties,
      });
      if (buffered.length > MAX_BUFFERED_EVENTS) {
        buffered.shift();
        yield* countEvictions(1);
      }
    });

  /**
   * Records the events held for the consent answer, in order, each with its
   * own time and page, under the identity, groups and session of now.
   */
  const replayBuffered = (): Effect.Effect<void> =>
    Effect.suspend(() => {
      const held = buffered;
      buffered = [];
      return Effect.forEach(
        held,
        (event) => enqueue(event.eventName, event.properties, event.options),
        { concurrency: 1, discard: true },
      );
    });

  /**
   * Queues an event and returns how many queued events are due: none of an
   * event held for the consent answer, with `analyticsWhilePending: "buffer"`.
   * Returns `undefined` when nothing was queued or held: analytics consent or a
   * pause kept the event out, or `analytics.beforeSend` dropped it. A dropped
   * event leaves no trace, not even in the session.
   */
  const enqueue = (
    eventName: string,
    properties?: Record<string, unknown>,
    options?: EnqueueOptions,
  ) =>
    Effect.gen(function* enqueue() {
      // Not held: a `$set`, which writes person traits the SDK observed, such
      // as a campaign's, and a `$sign_out`, which needs the consent of the
      // user who is leaving, not an answer the next visitor gives.
      if (
        config.analyticsWhilePending === "buffer" &&
        consent.current() === "pending" &&
        !consent.isPaused() &&
        eventName !== "$set" &&
        eventName !== "$sign_out"
      ) {
        yield* buffer(eventName, properties, options);
        return 0;
      }
      if (!(yield* permits("analytics.enqueue"))) return undefined;

      yield* loadQueue();

      const distinctId = identityManager.getDistinctId();
      if (Option.isNone(distinctId)) return;

      const availableAt = yield* Clock.currentTimeMillis;
      const activeSession = P.isString(options?.sessionId)
        ? Option.none<AnalyticsSession>()
        : Option.some(yield* sessionAt(availableAt));
      const context = options?.recordedOn ?? {
        ...platform.buildAnalyticsContext(yield* readPage()),
        ...options?.context,
      };
      const built = yield* createAnalyticsEvent(
        platform,
        distinctId.value,
        eventName,
        context,
        withGroups(eventName, properties),
        {
          ...options,
          sessionId: Option.match(activeSession, {
            onNone: () => options?.sessionId,
            onSome: (value) => value.id,
          }),
        },
      );
      const kept = yield* applyBeforeSend(built, context);
      if (Option.isNone(kept)) return undefined;
      const event = kept.value;
      if (Option.isSome(activeSession)) yield* recordSessionActivity(activeSession.value);

      events.push({
        attempts: 0,
        availableAt,
        id: event.uuid,
        payload: event,
        ...(options?.personWrite && { personWrite: true }),
        ...(options?.provisional && { provisional: true }),
      });

      yield* enforceQueueCap();
      // A provisional event is queued as the page is hidden, which may be the
      // last the page sees, so it cannot wait for a backed-up queue's interval.
      yield* options?.provisional ? persistQueue() : persistAfterEnqueue();
      // Events waiting out a retry backoff are not due, so an outage does not
      // turn every new event into another flush attempt.
      return Arr.length(Arr.filter(events, (queued) => isDue(queued, availableAt)));
    });

  /**
   * Sends the `$groupidentify` of a group while analytics consent is not
   * granted, and resolves with whether Voidhash took it. A group is what the
   * app says about the end user, not something the SDK observed, so it is sent
   * at once as a batch of its own that says consent is missing. It carries the
   * group and nothing else: no page, session, device, or other groups. Nothing
   * is stored for it and it is not retried; the caller sends it again.
   */
  const describeGroup = (properties: Record<string, unknown>) =>
    Effect.gen(function* describeGroup() {
      const distinctId = identityManager.getDistinctId();
      if (consent.isPaused() || Option.isNone(distinctId)) return false;
      const kept = yield* applyBeforeSend(
        {
          context: {},
          distinct_id: distinctId.value,
          event: GROUP_IDENTIFY_EVENT,
          properties: normalizeAnalyticsRecord(properties),
          // oxlint-disable-next-line effect/use-clock-service -- formats the time read from the Clock service.
          timestamp: new Date(yield* Clock.currentTimeMillis).toISOString(),
          uuid: createEventId(platform),
        },
        {},
      );
      if (Option.isNone(kept)) return false;
      const answer = yield* Effect.option(sendBatchViaClient([kept.value]));
      return Option.exists(answer, ({ status }) => status >= 200 && status < 300);
    });

  /**
   * The flush status as it is now: what was accepted since `acceptedBefore`,
   * a count {@link acceptedEvents} returned, and what is still queued. For a
   * caller that stops waiting while delivery carries on.
   */
  const statusSince = (acceptedBefore: number) =>
    Effect.sync(() => buildStatus(acceptedCount - acceptedBefore));

  /** How many events Voidhash accepted from this tab so far. */
  const acceptedEvents = () => Effect.sync(() => acceptedCount);

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
      JSON.stringify({ events: [], sent_at: sentAt, token: config.publishableKey }),
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
      // Consent may have changed while the flush waited for the queue lock.
      if (consent.current() !== "granted") return buildStatus(0);
      yield* loadQueue();
      const now = yield* Clock.currentTimeMillis;
      const due = peekBatch({
        leaveOutSending: options?.keepalive,
        maxBatchBytes: config.analytics.maxBatchBytes,
        maxBatchSize: batchSize,
        now,
      });
      // oxlint-disable-next-line effect/use-clock-service -- formats the time read from the Clock service.
      const sentAt = new Date(yield* Clock.currentTimeMillis).toISOString();
      const batch = options?.keepalive ? withinKeepaliveBudget(due, sentAt) : due;

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
      const accepted = Option.match(result, { onNone: () => 0, onSome: (it) => it.accepted });
      // The page is going away: one request is all a keepalive flush gets.
      if (options?.keepalive || Option.isNone(result)) return buildStatus(accepted);
      return yield* drainRemaining(accepted, 1);
    });

  /**
   * Sends the batches still due after a successful one, so a flush empties
   * the queue rather than sending one batch per identity. Stops at the first
   * batch that is not delivered, which keeps its backoff, and after
   * {@link MAX_BATCHES_PER_FLUSH} batches, which bounds the work of one call.
   */
  const drainRemaining = (
    flushed: number,
    batchesSent: number,
  ): Effect.Effect<AnalyticsFlushStatus> =>
    Effect.gen(function* drainRemainingBatches() {
      if (batchesSent >= MAX_BATCHES_PER_FLUSH || consent.current() !== "granted") {
        return buildStatus(flushed);
      }
      const batch = peekBatch({
        maxBatchBytes: config.analytics.maxBatchBytes,
        maxBatchSize: batchSize,
        now: yield* Clock.currentTimeMillis,
      });
      if (Arr.isReadonlyArrayEmpty(batch) || authGate.isPaused()) return buildStatus(flushed);
      const result = yield* sendBatch(batch);
      if (Option.isNone(result)) return buildStatus(flushed);
      return yield* drainRemaining(flushed + result.value.accepted, batchesSent + 1);
    });

  /**
   * Sends the next due batch. Never fails: transport problems leave the events
   * queued and are reported through the returned status and the diagnostics
   * hook. Concurrent calls in this tab share one flush, and tabs sharing the
   * same storage coordinate through a lease so a batch is sent exactly once.
   */
  const flush = (options?: { keepalive?: boolean }): Effect.Effect<AnalyticsFlushStatus> =>
    Effect.gen(function* flushEffect() {
      if (consent.current() !== "granted") return NOTHING_FLUSHED;
      yield* loadQueue();

      // On pagehide there is no time for cross-tab maintenance, and this tab
      // only ever touches its own segment, so the lock is not needed.
      if (options?.keepalive) {
        return yield* flushOnce(options);
      }

      const adopt = withQueueLock({
        name: MAINTENANCE_LOCK_KEY,
        onSkipped: undefined,
        owner: tabId,
        work: adoptOrphanSegments(),
      }).pipe(Effect.provideService(CacheAdapter, cacheAdapter));

      return yield* singleFlight.run(
        Effect.gen(function* trackedFlush() {
          // Forked so revoking consent can interrupt the send, aborting the
          // request and releasing the maintenance lock before it returns.
          const fiber = yield* Effect.forkChild(
            Effect.flatMap(adopt, () => flushOnce(options)),
            { startImmediately: true },
          );
          inFlightFlush = Option.some(fiber);
          const exit = yield* Fiber.await(fiber);
          inFlightFlush = Option.none();
          if (Exit.isSuccess(exit)) return exit.value;
          if (Cause.hasInterruptsOnly(exit.cause)) return NOTHING_FLUSHED;
          return yield* Effect.failCause(exit.cause);
        }),
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

  const startFlushTicker = () =>
    Effect.gen(function* startFlushTicker() {
      if (Option.isSome(flushTickerFiber) || consent.current() !== "granted") return;
      ownerLockRelease = yield* holdQueueOwnerLock(ownerLockKey);
      // Without the owner lock, a marker tells other tabs this segment is
      // owned; only its presence is read. A tab that holds the lock writes
      // none, so a page that never queues an event leaves nothing behind, and
      // it is written once rather than on every event: each write fires a
      // `storage` event in every other tab of the site.
      if (Option.isNone(ownerLockRelease)) {
        yield* Effect.flatMap(Clock.currentTimeMillis, (now) => cacheManager.set(ownerKey, now));
      }
      // In the background, so starting waits for no lock query; until it
      // answers, writes leave room for every other segment.
      yield* recountLiveTabs();
      flushTickerFiber = Option.some(yield* Effect.forkDetach(flushTicker));
    });

  const stopFlushTicker = () =>
    Effect.gen(function* stopFlushTicker() {
      if (Option.isNone(flushTickerFiber)) return;
      yield* Fiber.interrupt(flushTickerFiber.value);
      flushTickerFiber = Option.none();
      if (Option.isSome(liveTabsRecount)) yield* Fiber.interrupt(liveTabsRecount.value);
      liveTabsRecount = Option.none();
      // A count interrupted before it started never clears this itself.
      isRecountingLiveTabs = false;
      Option.getOrElse(ownerLockRelease, () => () => undefined)();
      ownerLockRelease = Option.none();
      yield* cacheManager.delete(ownerKey);
    });

  /**
   * Runs as the page is hidden for a navigation: sends what fits in one
   * `keepalive` request. When the page is unloading rather than entering the
   * back/forward cache, a tab without the owner lock also removes its owner
   * marker, the only sign other tabs have that it is gone, so the next page
   * adopts what it leaves. The send starts first, so the events it carries are
   * marked as handed to the browser and not adopted.
   */
  const leavePage = (options: { readonly isUnloading: boolean }) =>
    Effect.gen(function* leavePage() {
      // Events a backed-up queue has not stored yet would be lost with the page.
      yield* persistPending();
      const sending = yield* Effect.forkChild(flush({ keepalive: true }), {
        startImmediately: true,
      });
      // The request just started may carry some of them.
      if (options.isUnloading) {
        yield* reportUnstored(
          "leave with the page, unless the request sent as it closes delivers them",
          "analytics.leavePage",
        );
      }
      if (
        options.isUnloading &&
        Option.isSome(flushTickerFiber) &&
        Option.isNone(ownerLockRelease)
      ) {
        yield* cacheManager.delete(ownerKey);
      }
      return yield* Fiber.join(sending);
    });

  /**
   * Reports the events only this page holds, as it goes away: those its last
   * write did not store, past the storage budget or after storage refused
   * it, and those held for the app's consent answer.
   */
  const reportUnstored = (outcome: string, operation: string) =>
    Effect.gen(function* reportUnstored() {
      const unstored =
        events.filter((event) => !storedIds.has(event.id)).length + heldInMemory.length;
      if (unstored === 0) return;
      yield* diagnostics.report({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message: `${unstored} analytics event(s) were kept in memory only and ${outcome}.`,
        operation,
        retryable: false,
      });
    });

  /**
   * Decides the provisional `$pageleave` this tab queued: `send` once the page
   * is left, `drop` when the visitor returned, as the page view goes on.
   */
  const settleProvisionalLeave = (outcome: "send" | "drop") =>
    Effect.suspend(() => {
      events =
        outcome === "send"
          ? events.map(withoutProvisional)
          : events.filter((event) => !event.provisional);
      return persistAfterEnqueue();
    });

  /** Starts periodic flushing, which runs whenever consent is granted. */
  const start = () =>
    Effect.gen(function* start() {
      isStarted = true;
      yield* startFlushTicker();
    });

  const stop = () =>
    Effect.gen(function* stop() {
      isStarted = false;
      yield* reportEvictions();
      yield* persistPending();
      yield* reportUnstored("are lost as the client stops", "analytics.stop");
      yield* stopFlushTicker();
    });

  /** Interrupts the flush this tab is sending, which aborts its request. */
  const interruptFlush = () =>
    Option.match(inFlightFlush, {
      onNone: () => Effect.void,
      onSome: (fiber) => Fiber.interrupt(fiber),
    });

  /**
   * With the app as the source, `pending` waits for its answer: sending stops,
   * a send in progress is aborted, and the queue is left to storage alone. A
   * tab that adopts it meanwhile and this tab, once the answer is `granted`,
   * then never both send it.
   */
  const holdAnalytics = () =>
    Effect.gen(function* holdAnalytics() {
      yield* cancelPendingPersist();
      yield* stopFlushTicker();
      yield* interruptFlush();
      // What the last write stored, rather than what a read returns: after a
      // refused write, the storage adapter answers with the copy it holds in
      // memory. Held earlier and not reloaded since, as when the answer went
      // back to `pending` before anything was sent, events stay held too.
      const held = [...heldInMemory, ...events];
      heldInMemory = Arr.dedupeWith(held, (a, b) => a.id === b.id).filter(
        (event) => !storedIds.has(event.id),
      );
      events = [];
      isLoaded = false;
      storageRefusedAt = Option.none();
    });

  /**
   * Discards everything analytics holds once consent is gone: the flush in
   * progress, the in-memory queue, and every `analytics:` key in storage,
   * including the segments of other tabs and closed tabs.
   */
  const discardAnalytics = () =>
    Effect.gen(function* discardAnalytics() {
      yield* cancelPendingPersist();
      yield* stopFlushTicker();
      yield* interruptFlush();
      // What the app said about a person is not analytics: still queued, it
      // goes on as a person write, which consent does not hold back.
      yield* loadQueue();
      yield* Effect.forEach(
        events,
        ({ payload, personWrite }) => {
          const attributes = payload.properties?.$set;
          return personWrite && isJsonObject(attributes)
            ? identityManager.queuePersonWrite(payload.distinct_id, attributes)
            : Effect.void;
        },
        { concurrency: 1, discard: true },
      );
      events = [];
      heldInMemory = [];
      storageRefusedAt = Option.none();
      isLoaded = true;
      session = Option.none();
      persistedSession = Option.none();
      // Only this tab writes its own segment, so it needs no lock.
      yield* cacheManager.delete(segmentKey);
      // If another tab holds the lock, it receives the same consent change
      // through storage and clears the shared keys itself.
      yield* withQueueLock({
        name: MAINTENANCE_LOCK_KEY,
        onSkipped: undefined,
        owner: tabId,
        work: cacheManager.clearPrefix(ANALYTICS_KEY_PREFIX),
      }).pipe(Effect.provideService(CacheAdapter, cacheAdapter));
    });

  const readStoredConsent = (options?: { readonly refresh?: boolean }) =>
    Effect.map(cacheManager.get<unknown>(ANALYTICS_CONSENT_KEY, options), (stored) =>
      Option.filter(
        Option.map(stored, (hit) => hit.value),
        isAnalyticsConsent,
      ),
    );

  /**
   * Without `storeBeforeConsent`, writes the page's state, kept in memory until
   * now, to the device. Following a grant made in another tab, what that tab
   * stored wins: it is the identity the end user consented under.
   */
  const storeHeldState = (options: { readonly isFollowing: boolean }) =>
    config.storeBeforeConsent
      ? Effect.void
      : cacheAdapter.persistHeld({ preferStored: options.isFollowing });

  /**
   * Without `storeBeforeConsent`, takes the SDK's state off the device into
   * memory, where this page keeps using it. Analytics keys are left to
   * {@link discardAnalytics}: they may be other tabs' queues.
   */
  const holdStateInMemory = () =>
    Effect.gen(function* holdStateInMemory() {
      if (config.storeBeforeConsent) return;
      yield* cacheManager.holdInMemory(
        (key) =>
          key === ANALYTICS_CONSENT_KEY ||
          key === AD_DATA_SHARING_REVOCATIONS_KEY ||
          key.startsWith(ANALYTICS_KEY_PREFIX),
      );
      writeTouchState(touchStateKey(config.publishableKey), {});
    });

  /**
   * Stores an answer for later visits and other tabs. With the app as the
   * source, which reports its answer on every page, an unchanged answer is not
   * written again: every write fires the `storage` event in the site's other
   * tabs.
   */
  const storeConsent = (next: AnalyticsConsent) =>
    Effect.gen(function* storeConsent() {
      if (isAppSource && Option.contains(yield* readStoredConsent({ refresh: true }), next)) {
        return;
      }
      yield* cacheManager.set(ANALYTICS_CONSENT_KEY, next);
    });

  /**
   * Applies a consent change. Consent flips before anything else so no event
   * is recorded while the queue is being discarded. Revoking consent discards
   * queued and in-flight events; granting it resumes flushing without
   * replaying anything. `persist` is unset when following another tab.
   *
   * With the app as the source, `pending` only means its answer is not known:
   * recording and sending stop, and what is queued and stored stays for the
   * answer.
   */
  const applyConsent = (
    next: AnalyticsConsent,
    options: {
      /** Set by `identify()` with `grantConsentOnIdentify`: the grant is not the end user's answer. */
      readonly implied?: boolean;
      readonly persist: boolean;
    },
  ) =>
    Effect.gen(function* applyConsent() {
      const previous = consent.current();
      // Held for the app's answer, the queue is left to storage alone, so
      // events still waiting for their write are stored first.
      if (isAppSource && previous === "granted" && next === "pending") yield* persistPending();
      const previousChoice = consent.choice();
      // Before `initialize()`, the choice is still the option's, and the one an
      // earlier visit stored is about to be overwritten.
      const stored = yield* readStoredConsent({ refresh: true });
      consent.set(next);
      const choice = consent.choice();
      // State held in memory goes onto the device before the choice does, so
      // a tab that follows the choice finds this tab's identity there.
      if (choice === "granted" && previousChoice !== "granted") {
        yield* storeHeldState({ isFollowing: !options.persist });
      }
      // Here too before the choice is stored, and before anything is recorded
      // under the identity. A tab that follows takes on what this one stored.
      if (options.persist && previous !== "granted" && consent.current() === "granted") {
        yield* identityManager.reconcileSharedId();
      }
      // With the app as the source, only answers are stored, and `pending` is none.
      if (options.persist && choice === next && !(isAppSource && next === "pending")) {
        yield* storeConsent(next);
      }
      // An answer given here makes the choice the end user's own.
      if (options.persist && config.grantConsentOnIdentify) {
        yield* options.implied
          ? cacheManager.set(ANALYTICS_CONSENT_IMPLIED_KEY, true)
          : cacheManager.delete(ANALYTICS_CONSENT_IMPLIED_KEY);
      }
      if (
        choice !== "granted" &&
        (previousChoice === "granted" ||
          (Option.contains(stored, "granted") && !(isAppSource && next === "pending")))
      ) {
        identityManager.forgetSharedId();
      }
      if (choice !== "granted" && previousChoice === "granted") {
        yield* holdStateInMemory();
      }

      const effective = consent.current();
      if (effective === previous) return;

      if (effective === "granted") {
        consentDiagnosticReported = false;
        if (isStarted) yield* startFlushTicker();
        // What was held for the answer goes first. A grant followed from
        // another tab comes with that tab's identity, so the client replays
        // once it has taken that on.
        if (options.persist) yield* replayBuffered();
      } else if (isAppSource ? effective === "denied" : previous === "granted") {
        // What waited for the app's answer goes when the answer is `denied`.
        yield* discardAnalytics();
      } else if (previous === "granted") {
        yield* holdAnalytics();
      }
      if (effective === "denied") buffered = [];
      eventBus.emit("analytics-consent-changed", { consent: effective });
    });

  /**
   * Whether consent is granted because `identify()` implied it, on this page
   * or an earlier one, and no answer was given since.
   */
  const isConsentImplied = () =>
    config.grantConsentOnIdentify
      ? Effect.map(
          cacheManager.get<unknown>(ANALYTICS_CONSENT_IMPLIED_KEY, { refresh: true }),
          Option.isSome,
        )
      : Effect.succeed(false);

  /**
   * Loads the consent stored on an earlier visit, which takes precedence over
   * the `analyticsConsent` option. Without consent, anything a previous visit
   * left queued is discarded.
   *
   * With the app as the source, its answer wins and replaces the stored one.
   * Until it answers, the stored choice only decides what the SDK may keep on
   * the device, and what earlier pages queued waits for the answer.
   */
  const restoreConsent = () =>
    Effect.gen(function* restoreConsent() {
      const previous = consent.current();
      const stored = yield* readStoredConsent();
      const answer = consent.restore(stored);
      if (Option.isSome(answer)) {
        yield* cacheManager.set(ANALYTICS_CONSENT_KEY, answer.value);
        // The end user withdrew in the app's consent tool while the SDK was not running.
        if (Option.contains(stored, "granted")) identityManager.forgetSharedId();
      }

      // Reading the choice may have held the key index in memory before the
      // stored choice was known.
      yield* consent.choice() === "granted"
        ? storeHeldState({ isFollowing: true })
        : holdStateInMemory();
      const effective = consent.current();
      // `analytics.enabled: false` is a setting of this client, not the end
      // user's choice, so it leaves queues of other clients alone.
      const isWaiting = isAppSource && effective === "pending";
      if (config.analytics.enabled && effective !== "granted" && !isWaiting) {
        yield* discardAnalytics();
      }
      if (effective !== previous) {
        eventBus.emit("analytics-consent-changed", { consent: effective });
      }
    });

  /** Picks up a consent change another tab stored. */
  const syncConsentFromStorage = () =>
    Effect.gen(function* syncConsentFromStorage() {
      const stored = yield* readStoredConsent({ refresh: true });
      if (Option.isNone(stored)) return;
      yield* applyConsent(stored.value, { persist: false });
    });

  /**
   * Makes every queued event immediately due. Used when connectivity is
   * restored, where waiting out a backoff computed during the outage is
   * pointless.
   */
  const resetBackoff = () =>
    Effect.gen(function* resetBackoff() {
      if (consent.current() !== "granted") return;
      yield* loadQueue();
      const now = yield* Clock.currentTimeMillis;
      events = events.map((event) => ({ ...event, availableAt: now }));
      yield* persistQueue();
    });

  return {
    acceptedEvents,
    applyConsent,
    describeGroup,
    enqueue,
    flush,
    getSessionId,
    isConsentImplied,
    lastSessionId,
    leavePage,
    otherQueueChanged,
    permits,
    persistPending,
    readPage,
    replayBuffered,
    resetBackoff,
    restoreConsent,
    rotateSession,
    settleProvisionalLeave,
    start,
    statusSince,
    stop,
    syncConsentFromStorage,
  };
});

export class AnalyticsService extends Context.Service<
  AnalyticsService,
  Effect.Success<ReturnType<typeof makeAnalyticsService>>
>()("web-voidhash/AnalyticsService") {}
