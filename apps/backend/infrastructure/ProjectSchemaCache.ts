import { ProjectSchemaCache } from "@voidhash/core/services";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";

interface CacheEntry {
  readonly expiresAt: number;
  readonly schema: unknown;
}

/** Isolate-local schema cache used by the Community Cloudflare worker. */
export const ProjectSchemaCacheLive = Layer.sync(ProjectSchemaCache, () => {
  const entries = MutableHashMap.empty<string, CacheEntry>();
  return {
    getByName: (projectId: string) => ({
      get: () =>
        Effect.gen(function* () {
          const entry = MutableHashMap.get(entries, projectId);
          if (Option.isNone(entry)) return undefined;
          if (entry.value.expiresAt > (yield* Clock.currentTimeMillis)) return entry.value.schema;
          MutableHashMap.remove(entries, projectId);
          return undefined;
        }),
      invalidate: () => Effect.sync(() => void MutableHashMap.remove(entries, projectId)),
      set: (schema: unknown, ttlMs: number) =>
        Clock.currentTimeMillis.pipe(
          Effect.tap((now) =>
            Effect.sync(
              () => void MutableHashMap.set(entries, projectId, { expiresAt: now + ttlMs, schema }),
            ),
          ),
          Effect.asVoid,
        ),
    }),
  };
});
