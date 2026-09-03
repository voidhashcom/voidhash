import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import type {
  CaptureCredentialRepositoryShape,
  ResolvedCaptureProject,
} from "../../application/ports/CapturePolicy.ts";

/** Sizing and freshness bounds for a {@link CaptureCredentialCache}. */
export interface CaptureCredentialCacheOptions {
  /** Entries retained before the cache is cleared wholesale. */
  readonly capacity: number;
  /** How long a resolved credential (or a confirmed unknown one) stays fresh. */
  readonly timeToLive: Duration.Input;
}

type CachedProject = typeof ResolvedCaptureProject.Type | typeof Schema.Undefined.Type;

interface CacheEntry {
  readonly expiresAt: number;
  readonly value: CachedProject;
}

/**
 * Process-lifetime memo of credential lookups. Capture runs one credential
 * query per request, and the answer (project, policy, quotas) changes rarely,
 * so the runtime keeps one of these at module scope and wraps its repository
 * with {@link withCaptureCredentialCache}. Unknown credentials are cached too so
 * a flood of junk tokens cannot turn into a flood of database reads.
 */
export interface CaptureCredentialCache {
  readonly get: (key: string) => Effect.Effect<Option.Option<CachedProject>>;
  readonly set: (key: string, value: CachedProject) => Effect.Effect<void>;
  readonly clear: Effect.Effect<void>;
}

/** Create an empty credential cache with the given bounds. */
export const makeCaptureCredentialCache = (
  options: CaptureCredentialCacheOptions,
): CaptureCredentialCache => {
  const entries = MutableHashMap.empty<string, CacheEntry>();
  const timeToLive = Duration.toMillis(options.timeToLive);
  return {
    get: (key) =>
      Effect.map(Clock.currentTimeMillis, (now) =>
        Option.flatMap(MutableHashMap.get(entries, key), (entry) => {
          if (entry.expiresAt > now) return Option.some(entry.value);
          MutableHashMap.remove(entries, key);
          return Option.none();
        }),
      ),
    set: (key, value) =>
      Effect.map(Clock.currentTimeMillis, (now) => {
        // Clearing everything is deliberate: the cache is small, entries are
        // cheap to rebuild, and it keeps memory bounded without LRU bookkeeping.
        if (MutableHashMap.size(entries) >= options.capacity) MutableHashMap.clear(entries);
        MutableHashMap.set(entries, key, { expiresAt: now + timeToLive, value });
      }),
    clear: Effect.sync(() => {
      MutableHashMap.clear(entries);
    }),
  };
};

const cacheKey = (input: { readonly isPublic: boolean; readonly lookupKey: string }) =>
  `${input.isPublic ? "pk" : "sk"}:${input.lookupKey}`;

/** Serve repeated credential lookups from `cache`, consulting `repository` only on a miss. */
export const withCaptureCredentialCache =
  (cache: CaptureCredentialCache) =>
  (repository: CaptureCredentialRepositoryShape): CaptureCredentialRepositoryShape => ({
    resolve: (input) =>
      Effect.flatMap(cache.get(cacheKey(input)), (cached) =>
        Option.match(cached, {
          onSome: Effect.succeed,
          onNone: () =>
            Effect.tap(repository.resolve(input), (project) => cache.set(cacheKey(input), project)),
        }),
      ),
  });
