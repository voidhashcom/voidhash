import { ProjectSchemaCache } from "@voidhash/core/services";
import { Clock, Effect, Layer } from "effect";

interface CacheEntry {
  readonly expiresAt: number;
  readonly schema: unknown;
}

/** In-memory project-schema cache for a single Node process. */
export const MemoryProjectSchemaCacheLive = Layer.sync(ProjectSchemaCache, () => {
  const entries = new Map<string, CacheEntry>();
  return {
    getByName: (projectId: string) => ({
      get: () =>
        Effect.gen(function* () {
          const entry = entries.get(projectId);
          if (!entry) return undefined;
          const now = yield* Clock.currentTimeMillis;
          if (entry.expiresAt <= now) {
            entries.delete(projectId);
            return undefined;
          }
          return entry.schema;
        }),
      invalidate: () => Effect.sync(() => void entries.delete(projectId)),
      set: (schema: unknown, ttlMs: number) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          entries.set(projectId, { expiresAt: now + ttlMs, schema });
        }),
    }),
  };
});
