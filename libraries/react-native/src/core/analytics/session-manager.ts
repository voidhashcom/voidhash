import * as P from "effect/Predicate";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";

import { CacheManager } from "../caching/cache-manager";
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
 * captures; `current()` is called for every event entering the queue and
 * rotates the id once that gap is exceeded. The session is persisted through
 * `CacheManager` so it survives process restarts, and the persisted entry is
 * loaded when the service is built, so a relaunch within the timeout keeps
 * the previous session.
 *
 * Persistence failures are swallowed: losing the persisted session only costs
 * continuity across restarts, whereas failing the capture would lose events.
 */
export class AnalyticsSessionManager extends Context.Service<AnalyticsSessionManager>()(
  "rn-voidhash/AnalyticsSessionManager",
  {
    make: Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      const clock = yield* Clock.Clock;
      // Serializes `current`/`rotate` so concurrent captures never mint two
      // ids for the same inactivity gap.
      const mutex = yield* Semaphore.make(1);

      const persisted = yield* cacheManager.get<unknown>(ANALYTICS_SESSION_STORAGE_KEY).pipe(
        Effect.map((hit) =>
          Option.filter(
            Option.map(hit, (entry) => entry.value),
            isAnalyticsSession,
          ),
        ),
        // `CacheManager.get` dies on an undecodable envelope; a corrupt entry
        // is treated the same as an absent one.
        // oxlint-disable-next-line effect/effect-catchall-default -- deliberate blanket recovery: typed failures and defects alike must degrade to "no persisted session" (see the class doc comment).
        Effect.catchCause(() => Effect.succeed(Option.none<AnalyticsSession>())),
      );
      const sessionRef = yield* Ref.make(persisted);

      const persist = (session: AnalyticsSession) =>
        cacheManager
          .set(ANALYTICS_SESSION_STORAGE_KEY, session)
          .pipe(Effect.orElseSucceed(() => undefined));

      const replace = Effect.fn("AnalyticsSessionManager.replace")(function* (
        session: AnalyticsSession,
      ) {
        yield* Ref.set(sessionRef, Option.some(session));
        yield* persist(session);
        return session.id;
      });

      const rotate = Effect.fn("AnalyticsSessionManager.rotate")(function* () {
        const now = yield* Clock.currentTimeMillis;
        return yield* replace({ id: getNonce(), lastEventAt: now });
      }, mutex.withPermits(1));

      const current = Effect.fn("AnalyticsSessionManager.current")(function* () {
        const now = yield* Clock.currentTimeMillis;
        const session = yield* Ref.get(sessionRef);
        const active = Option.filter(session, (existing) => isWithinTimeout(existing, now));
        return yield* Option.match(active, {
          onNone: () => replace({ id: getNonce(), lastEventAt: now }),
          onSome: (existing) => replace({ id: existing.id, lastEventAt: now }),
        });
      }, mutex.withPermits(1));

      // oxlint-disable-next-line effect/prefer-option-over-null -- synchronous mirror of the public `getSessionId()` SDK method, which documents `undefined` as "no active session"; Effect callers use `current()`.
      const getCurrentIdUnsafe = (): string | undefined => {
        const now = clock.currentTimeMillisUnsafe();
        return Option.getOrUndefined(
          Option.map(
            Option.filter(sessionRef.ref.current, (session) => isWithinTimeout(session, now)),
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
         * Synchronous read of the active session id without touching it.
         * `undefined` when no session exists or it has timed out.
         */
        getCurrentIdUnsafe,
        /** Unconditionally starts a new session and persists it. */
        rotate,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
