import { ProjectSchemaCache } from "@voidhash/core/services";
import { Effect, Layer } from "effect";

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
        Effect.sync(() => {
          const entry = entries.get(projectId);
          if (!entry) return undefined;
          if (entry.expiresAt <= Date.now()) {
            entries.delete(projectId);
            return undefined;
          }
          return entry.schema;
        }),
      invalidate: () => Effect.sync(() => void entries.delete(projectId)),
      set: (schema: unknown, ttlMs: number) =>
        Effect.sync(() => {
          entries.set(projectId, { expiresAt: Date.now() + ttlMs, schema });
        }),
    }),
  };
});
