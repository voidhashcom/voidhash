import * as P from "effect/Predicate";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";

import { type CacheReadFailed } from "../caching/cache-adapter";
import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { getNonce } from "../utils/crypto";

/** Cache key under which the current analytics session is persisted. */
export const ANALYTICS_SESSION_STORAGE_KEY = "voidhash:analytics:session";

/**
 * Inactivity window after which the next captured event starts a new session.
 * Shared with the iOS and Android SDKs so sessions mean the same thing on
 * every platform.
 */
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/** Persisted shape of an analytics session. */
export interface AnalyticsSession {
  /** Lowercase UUID identifying the session. */
  readonly id: string;
  /** Epoch milliseconds of the last event captured in this session. */
  readonly lastEventAt: number;
}

const isAnalyticsSession = (value: unknown): value is AnalyticsSession =>
  P.hasProperty(value, "id") &&
  P.isString(value.id) &&
  P.hasProperty(value, "lastEventAt") &&
  P.isNumber(value.lastEventAt);

const isWithinTimeout = (session: AnalyticsSession, now: number) =>
  now - session.lastEventAt <= SESSION_INACTIVITY_TIMEOUT_MS;

/**
 * Owns the analytics session id. A session is a run of events with no gap
 * longer than {@link SESSION_INACTIVITY_TIMEOUT_MS} between consecutive
 * captures; the session id is resolved for every event entering the queue and
 * rotates once that gap is exceeded. The session is persisted through
 * `CacheManager` so it survives process restarts, and the persisted entry is
 * loaded when the service is built, so a relaunch within the timeout keeps
 * the previous session.
 *
 * The authoritative session state lives in memory and persistence runs behind
 * it, fire-and-forget. That is what makes `capture()` safe to run
 * synchronously: the storage adapter on React Native is promise-backed, so a
 * capture that awaited a write would die when run on the calling thread.
 * Persistence failures are swallowed — losing the persisted session only costs
 * continuity across restarts, whereas failing the capture would lose events.
 */
export class AnalyticsSessionManager extends Context.Service<AnalyticsSessionManager>()(
  "rn-voidhash/AnalyticsSessionManager",
  {
    make: Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      const clock = yield* Clock.Clock;
      const diagnostics = yield* Diagnostics;

      // A store that cannot be read costs session continuity across this
      // restart, nothing more: the next capture simply starts a new session.
      const persisted = yield* cacheManager.tryGet<unknown>(ANALYTICS_SESSION_STORAGE_KEY).pipe(
        Effect.map((hit) =>
          Option.filter(
            Option.map(hit, (entry) => entry.value),
            isAnalyticsSession,
          ),
        ),
        Effect.catch((failure: CacheReadFailed) =>
          Effect.as(
            diagnostics.emit({
              code: DIAGNOSTIC_CODES.CACHE_READ_FAILED,
              kind: "cache",
              message: `Could not read the persisted analytics session: ${failure.message}`,
              operation: "capture",
              retryable: false,
            }),
            Option.none<AnalyticsSession>(),
          ),
        ),
      );
      const sessionRef = MutableRef.make(persisted);

      // `CacheManager.set` absorbs store faults itself; losing the persisted
      // session only costs continuity across restarts.
      const persist = (session: AnalyticsSession) =>
        cacheManager.set(ANALYTICS_SESSION_STORAGE_KEY, session);

      // One writer at a time. Every capture asks for the session to be
      // persisted, and a burst of captures over a promise-backed store would
      // otherwise fan out into one storage round trip per event; instead a
      // request that arrives while a write is running marks the session dirty
      // and the running writer picks the latest state up before it returns.
      const writing = MutableRef.make(false);
      const dirty = MutableRef.make(false);
      const drainWrites: Effect.Effect<void> = Effect.suspend(() => {
        const session = MutableRef.get(sessionRef);
        MutableRef.set(dirty, false);
        if (Option.isNone(session)) return Effect.void;
        return Effect.flatMap(persist(session.value), () =>
          MutableRef.get(dirty) ? drainWrites : Effect.void,
        );
      });

      /**
       * Resolves the active session id from memory, starting a new session
       * when there is none or the inactivity timeout has elapsed, and records
       * this moment as the session's last activity. The write behind it is
       * forked, so this returns without touching storage.
       */
      const touchUnsafe = (): string => {
        const now = clock.currentTimeMillisUnsafe();
        const existing = Option.filter(MutableRef.get(sessionRef), (session) =>
          isWithinTimeout(session, now),
        );
        const session: AnalyticsSession = {
          id: Option.match(existing, { onNone: getNonce, onSome: (value) => value.id }),
          lastEventAt: now,
        };
        MutableRef.set(sessionRef, Option.some(session));
        return session.id;
      };

      const flushPersist = () =>
        Effect.suspend(() => {
          if (Option.isNone(MutableRef.get(sessionRef))) return Effect.void;
          if (MutableRef.get(writing)) {
            MutableRef.set(dirty, true);
            return Effect.void;
          }
          MutableRef.set(writing, true);
          return Effect.ensuring(
            drainWrites,
            Effect.sync(() => {
              MutableRef.set(writing, false);
            }),
          );
        });

      const current = Effect.fn("AnalyticsSessionManager.current")(function* () {
        const id = touchUnsafe();
        yield* flushPersist();
        return id;
      });

      const rotate = Effect.fn("AnalyticsSessionManager.rotate")(function* () {
        const now = yield* Clock.currentTimeMillis;
        const session: AnalyticsSession = { id: getNonce(), lastEventAt: now };
        MutableRef.set(sessionRef, Option.some(session));
        yield* persist(session);
        return session.id;
      });

      // oxlint-disable-next-line effect/prefer-option-over-null -- synchronous mirror of the public `getSessionId()` SDK method, which documents `undefined` as "no active session"; Effect callers use `current()`.
      const getCurrentIdUnsafe = (): string | undefined => {
        const now = clock.currentTimeMillisUnsafe();
        return Option.getOrUndefined(
          Option.map(
            Option.filter(MutableRef.get(sessionRef), (session) => isWithinTimeout(session, now)),
            (session) => session.id,
          ),
        );
      };

      return {
        /**
         * Returns the id of the active session, starting a new one when there
         * is none or the inactivity timeout has elapsed, and records the
         * current time as the session's last activity.
         */
        current,
        /**
         * Writes the in-memory session to storage. Called before a flush and
         * behind every capture. Writes are coalesced: while one is running,
         * further calls return at once and the running write re-reads the
         * session before it finishes, so the latest state always lands.
         */
        flushPersist,
        /**
         * Synchronous read of the active session id without touching it.
         * `undefined` when no session exists or it has timed out.
         */
        getCurrentIdUnsafe,
        /** Unconditionally starts a new session and persists it. */
        rotate,
        /**
         * Synchronous variant of {@link current} for the capture path. The
         * persisted copy is updated by the next `flushPersist`.
         */
        touchUnsafe,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
