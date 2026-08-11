import { ProjectSchemaCache } from "@voidhash/core/services";
import { Clock, Effect, Layer } from "effect";

interface CacheEntry {
  readonly expiresAt: number;
  readonly schema: unknown;
}

/** Isolate-local schema cache used by the Community Cloudflare worker. */
export const ProjectSchemaCacheLive = Layer.sync(ProjectSchemaCache, () => {
  const entries = new Map<string, CacheEntry>();
  return {
    getByName: (projectId: string) => ({
      get: () =>
        Effect.gen(function* () {
          const entry = entries.get(projectId);
          if (!entry) return undefined;
          if (entry.expiresAt > (yield* Clock.currentTimeMillis)) return entry.schema;
          entries.delete(projectId);
          return undefined;
        }),
      invalidate: () => Effect.sync(() => void entries.delete(projectId)),
      set: (schema: unknown, ttlMs: number) =>
        Clock.currentTimeMillis.pipe(
          Effect.tap((now) =>
            Effect.sync(() => void entries.set(projectId, { expiresAt: now + ttlMs, schema })),
          ),
          Effect.asVoid,
        ),
    }),
  };
});
