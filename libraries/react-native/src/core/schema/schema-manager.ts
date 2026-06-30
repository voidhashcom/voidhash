import { Effect, Layer, Context } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";

import { FailedToFetchSchemaError } from "../../errors";
import { CacheManager } from "../caching/cache-manager";
import { ApiClient } from "../networking/api-client";
import { PlatformProvider } from "../platform/platform-provider";
import { schemaAtom } from "../reactivity/client-state";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import type { RuntimeSchema } from "./runtime";

/**
 * 30 days. Covers long offline gaps (user reopens the app after a month)
 * while bounding cache staleness. Combined with the unconditional background
 * refresh on cache hits this gives a stale-while-revalidate read path: hot
 * sessions always get cached data immediately and the next session benefits
 * from the refresh that landed in the background.
 */
const SCHEMA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const generateSchemaCacheKey = (appVersion: string) => `schema:${appVersion}`;

const toFetchError = (cause: unknown): FailedToFetchSchemaError => {
  const errorCause = cause instanceof Error ? cause : new Error(String(cause));
  return new FailedToFetchSchemaError("Failed to fetch schema at init", errorCause);
};

interface ResolveSchemaArgs {
  readonly distinctId: string;
  readonly internalSchema?: RuntimeSchema;
}

/**
 * Resolves the runtime schema with a stale-while-revalidate cache keyed by
 * the current app version. On a cold cache the synchronous fetch is fatal
 * (`FailedToFetchSchemaError`). On a warm cache the cached value is returned
 * immediately and a background fiber refreshes both the cache and
 * `schemaAtom`.
 *
 * App-version keying matters because features in a new app build may
 * reference products, locations, or perks that don't exist in an older
 * cached schema — using a separate cache key per version makes upgrades
 * safe by forcing a fresh fetch on the first launch of a new build.
 */
export class SchemaManager extends Context.Service<SchemaManager>()("rn-voidhash/SchemaManager", {
  make: Effect.gen(function* () {
    const cacheManager = yield* CacheManager;
    const apiClient = yield* ApiClient;
    const platformProvider = yield* PlatformProvider;
    const atomRegistry = yield* AtomRegistry.AtomRegistry;

    const publishSchema = (schema: RuntimeSchema) => {
      atomRegistry.set(schemaAtom, schema);
    };

    const fetchFromServer = (distinctId: string) =>
      Effect.gen(function* () {
        const commonHeaders = yield* getCommonSdkHeaders();
        return yield* apiClient.sdk.getSchema({
          headers: {
            ...commonHeaders,
            "x-distinct-id": distinctId,
          },
        });
      });

    const cacheAndPublish = (cacheKey: string, schema: RuntimeSchema) =>
      Effect.gen(function* () {
        yield* cacheManager.set(cacheKey, schema, {
          ttl: SCHEMA_CACHE_TTL_MS,
        });
        publishSchema(schema);
      });

    /**
     * Fork a background refresh that outlives `init()`'s scope.
     * `forkDetach` decouples the fiber from the caller scope so a cache
     * hit on init returns synchronously while the refresh still completes
     * later. Long-term, the proper shape is a scoped consumer fiber
     * backed by a queue (see `analytics/service.ts` for that pattern);
     * `forkDetach` is the lightweight equivalent for a single-shot
     * request.
     */
    const scheduleBackgroundRefresh = (cacheKey: string, distinctId: string) =>
      fetchFromServer(distinctId).pipe(
        Effect.tap((schema) => cacheAndPublish(cacheKey, schema)),
        Effect.catch((cause) =>
          Effect.logDebug("[voidhash] schema background refresh failed", { cause }),
        ),
        // `startImmediately: true` so the fiber runs without waiting for
        // the next yield point — important because `resolveSchema`
        // returns synchronously after this and the caller may not yield
        // again for some time.
        Effect.forkDetach({ startImmediately: true }),
      );

    const resolveSchema = ({ distinctId, internalSchema }: ResolveSchemaArgs) =>
      Effect.gen(function* () {
        // Test/internal escape hatch — never hit the cache or network.
        if (internalSchema) {
          publishSchema(internalSchema);
          return internalSchema;
        }

        const { appVersion } = platformProvider;

        // No app version means we can't safely key the cache (features in
        // a future build could reference items missing from the cached
        // schema). Skip the cache entirely and always fetch synchronously;
        // a failure is fatal.
        if (!appVersion) {
          yield* Effect.logWarning(
            "[voidhash] No appVersion available — skipping schema cache and fetching synchronously.",
          );
          const schema = yield* fetchFromServer(distinctId).pipe(Effect.mapError(toFetchError));
          publishSchema(schema);
          return schema;
        }

        const cacheKey = generateSchemaCacheKey(appVersion);
        const cached = yield* cacheManager.get<RuntimeSchema>(cacheKey);

        // Cache hit: serve immediately and unconditionally revalidate in
        // the background. `CacheManager.get` already drops expired
        // entries before returning, so any non-null hit is fresh enough
        // to serve.
        if (cached) {
          publishSchema(cached.value);
          yield* scheduleBackgroundRefresh(cacheKey, distinctId);
          return cached.value;
        }

        // Cache miss (including expired-and-dropped entries). Synchronous
        // fetch — failures are fatal.
        const schema = yield* fetchFromServer(distinctId).pipe(Effect.mapError(toFetchError));
        yield* cacheAndPublish(cacheKey, schema);
        return schema;
      });

    return { resolveSchema } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
