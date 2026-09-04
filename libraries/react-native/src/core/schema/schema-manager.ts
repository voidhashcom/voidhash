import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { AtomRegistry } from "effect/unstable/reactivity";

import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { ApiClient } from "../networking/api-client";
import { breakerKey, CircuitBreaker } from "../network/circuit-breaker";
import {
  countsTowardsBreaker,
  httpStatusOf,
  isAuthStatus,
  isRetryableStatus,
  withRequestTimeout,
} from "../network/policy";
import { AuthGate } from "../network/auth-gate";
import { SingleFlight } from "../network/single-flight";
import { PlatformProvider } from "../platform/platform-provider";
import { schemaAtom } from "../reactivity/client-state";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { createEmptyRuntimeSchema, RuntimeSchemaValue } from "./runtime";
import type { RuntimeSchema, RuntimeSchemaEncoded } from "./runtime";

/**
 * 30 days. Covers long offline gaps (user reopens the app after a month).
 * An entry past its TTL is still served — it only becomes urgent to refresh.
 */
const SCHEMA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** 24 hours. Past this the cached schema is served while a refresh runs. */
const SCHEMA_CACHE_STALE_MS = 1000 * 60 * 60 * 24;

/**
 * Single schema entry. The app version lives inside the envelope rather than
 * in the key, so an app update finds the previous schema instead of a cold
 * cache — the entry is refreshed in the background and the mismatch is what
 * makes that refresh urgent.
 */
export const SCHEMA_CACHE_KEY = "schema:current";

/** Pre-`schema:current` key layout, read once so upgrades keep their cache. */
const legacySchemaCacheKey = (appVersion: string) => `schema:${appVersion}`;

interface SchemaCacheEntry {
  readonly appVersion: string;
  readonly schema: RuntimeSchemaEncoded;
}

const isSchemaCacheEntry = (value: unknown): value is SchemaCacheEntry =>
  P.hasProperty(value, "appVersion") &&
  P.isString(value.appVersion) &&
  P.hasProperty(value, "schema") &&
  P.isObject(value.schema);

interface ResolveSchemaArgs {
  readonly distinctId: string;
  readonly internalSchema?: RuntimeSchema;
}

/**
 * Resolves the runtime schema from local state first and keeps it fresh in the
 * background. A cached schema is served at any age; a cold cache tries the
 * network once and falls back to an empty schema when the server is
 * unreachable, so a first launch with no connectivity still boots — analytics,
 * lifecycle events and identity do not depend on the schema.
 */
export class SchemaManager extends Context.Service<SchemaManager>()("rn-voidhash/SchemaManager", {
  make: Effect.gen(function* () {
    const cacheManager = yield* CacheManager;
    const apiClient = yield* ApiClient;
    const platformProvider = yield* PlatformProvider;
    const atomRegistry = yield* AtomRegistry.AtomRegistry;
    const sdkConfiguration = yield* SdkConfiguration;
    const diagnostics = yield* Diagnostics;
    const breaker = yield* CircuitBreaker;
    const singleFlight = yield* SingleFlight;
    const authGate = yield* AuthGate;
    const serviceScope = yield* Effect.scope;
    const schemaBreakerKey = breakerKey("config", sdkConfiguration.baseUrl);

    const publishSchema = (schema: RuntimeSchema) => {
      atomRegistry.set(schemaAtom, Option.some(schema));
    };

    const fetchFromServer = Effect.fn("SchemaManager.fetchFromServer")(function* (
      distinctId: string,
    ) {
      const commonHeaders = yield* getCommonSdkHeaders();
      return yield* withRequestTimeout(
        "getSchema",
        apiClient.sdk.getSchema({
          headers: {
            ...commonHeaders,
            "x-distinct-id": distinctId,
          },
        }),
      );
    });

    const cacheAndPublish = Effect.fn("SchemaManager.cacheAndPublish")(function* (
      schema: RuntimeSchema,
    ) {
      const encoded = yield* Schema.encodeEffect(RuntimeSchemaValue)(schema).pipe(Effect.orDie);
      const entry: SchemaCacheEntry = {
        appVersion: platformProvider.appVersion ?? "",
        schema: encoded,
      };
      yield* cacheManager.set(SCHEMA_CACHE_KEY, entry, {
        staleTime: SCHEMA_CACHE_STALE_MS,
        ttl: SCHEMA_CACHE_TTL_MS,
      });
      publishSchema(schema);
    });

    /**
     * One network refresh, gated by the breaker and de-duplicated across
     * callers. Never fails: a schema that cannot be refreshed simply stays at
     * its cached value.
     */
    const refresh = (distinctId: string) =>
      singleFlight.run(
        SCHEMA_CACHE_KEY,
        Effect.fn("SchemaManager.refresh")(function* () {
          // A rejected key pauses schema refreshes too: the cached schema is
          // served meanwhile and one probe is allowed through per cool-down.
          const authProbe = authGate.isPaused() ? yield* authGate.probe() : false;
          if (authGate.isPaused() && !authProbe) {
            return Option.none<RuntimeSchema>();
          }
          const allowed = yield* breaker.canAttempt(schemaBreakerKey, "getSchema");
          if (!allowed) {
            if (authProbe) yield* authGate.completeProbe(false);
            return Option.none<RuntimeSchema>();
          }

          const result = yield* Effect.result(fetchFromServer(distinctId));
          if (Result.isFailure(result)) {
            const status = httpStatusOf(result.failure);
            const statusCode = Option.getOrUndefined(status);
            if (authProbe) {
              yield* authGate.completeProbe(statusCode !== undefined && !isAuthStatus(statusCode));
            }
            if (statusCode !== undefined && isAuthStatus(statusCode)) {
              yield* breaker.releaseProbe(schemaBreakerKey);
              yield* authGate.pause("getSchema", statusCode);
            } else if (statusCode === undefined || countsTowardsBreaker(statusCode)) {
              yield* breaker.recordFailure(schemaBreakerKey);
            } else {
              yield* breaker.releaseProbe(schemaBreakerKey);
            }
            yield* diagnostics.emit({
              code: DIAGNOSTIC_CODES.REQUEST_FAILED,
              httpStatus: Option.getOrUndefined(status),
              kind: "transport",
              message: "Schema refresh failed; serving the cached schema",
              operation: "getSchema",
              retryable: Option.match(status, {
                onNone: () => true,
                onSome: isRetryableStatus,
              }),
            });
            return Option.none<RuntimeSchema>();
          }

          if (authProbe) yield* authGate.completeProbe(true);
          yield* breaker.recordSuccess(schemaBreakerKey);
          yield* cacheAndPublish(result.success);
          return Option.some(result.success);
        })(),
      );

    const decodeEntry = (encoded: RuntimeSchemaEncoded) =>
      Effect.option(Schema.decodeUnknownEffect(RuntimeSchemaValue)(encoded));

    /**
     * Reads `schema:current`, falling back once to the pre-migration
     * `schema:{appVersion}` key so an SDK upgrade does not start cold.
     */
    const readCachedSchema = Effect.fn("SchemaManager.readCachedSchema")(function* () {
      const current = yield* cacheManager.get<unknown>(SCHEMA_CACHE_KEY);
      const currentEntry = Option.filter(
        Option.map(current, (hit) => hit.value),
        isSchemaCacheEntry,
      );
      if (Option.isSome(currentEntry)) {
        const decoded = yield* decodeEntry(currentEntry.value.schema);
        return Option.map(decoded, (schema) => ({
          appVersion: currentEntry.value.appVersion,
          isStale: Option.isSome(current) && (current.value.isStale || current.value.isExpired),
          schema,
        }));
      }

      const appVersion = platformProvider.appVersion;
      if (!appVersion) return Option.none<never>();

      const legacy = yield* cacheManager.get<RuntimeSchemaEncoded>(
        legacySchemaCacheKey(appVersion),
      );
      if (Option.isNone(legacy)) return Option.none<never>();

      const decoded = yield* decodeEntry(legacy.value.value);
      if (Option.isNone(decoded)) return Option.none<never>();

      // Migrate forward and retire the old key; `schema:current` is the only
      // key written from here on.
      yield* cacheAndPublish(decoded.value);
      yield* cacheManager.delete(legacySchemaCacheKey(appVersion));
      return Option.some({
        appVersion,
        isStale: legacy.value.isStale || legacy.value.isExpired,
        schema: decoded.value,
      });
    });

    const resolveSchema = Effect.fn("SchemaManager.resolveSchema")(function* ({
      distinctId,
      internalSchema,
    }: ResolveSchemaArgs) {
      // Test/internal escape hatch — never hit the cache or network.
      if (internalSchema) {
        publishSchema(internalSchema);
        return internalSchema;
      }

      const cached = yield* readCachedSchema();
      if (Option.isSome(cached)) {
        publishSchema(cached.value.schema);
        // A build whose version differs from the cached entry may reference
        // items the cached schema does not have, so that refresh is as urgent
        // as an expired entry — but it still never blocks the boot.
        yield* Effect.forkIn(refresh(distinctId), serviceScope, { startImmediately: true });
        return cached.value.schema;
      }

      // Cold cache: one attempt, then boot on an empty schema. Commerce reads
      // degrade; analytics, lifecycle and identity are unaffected.
      const refreshed = yield* refresh(distinctId);
      return Option.getOrElse(refreshed, () => {
        const empty = createEmptyRuntimeSchema();
        publishSchema(empty);
        return empty;
      });
    });

    return { refresh, resolveSchema } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
