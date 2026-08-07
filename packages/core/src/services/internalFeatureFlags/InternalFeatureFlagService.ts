import { constant } from "@voidhash/lib/lang";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Db, and, eq, inArray, internalFeatureFlagOverrides } from "@voidhash/db";
import {
  INTERNAL_FEATURE_FLAG_LIST,
  isInternalFeatureFlagKey,
  type InternalFeatureFlagKey,
} from "@voidhash/rpc";

import { generateId } from "../../utils/generate-id.ts";

/** Tagged error raised by {@link InternalFeatureFlagService} public methods. */
export class InternalFeatureFlagServiceError extends Schema.TaggedErrorClass<InternalFeatureFlagServiceError>(
  "InternalFeatureFlagServiceError",
)("InternalFeatureFlagServiceError", { message: Schema.String }) {}

/** One internal feature flag resolved for an organization. */
export interface ResolvedInternalFeatureFlag {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  /** The explicit per-org override, or `null` when falling back to the default. */
  readonly override: boolean | null;
  /** The effective on/off state: `override ?? defaultEnabled`. */
  readonly enabled: boolean;
}

/**
 * Resolve the effective state for every registry flag given an org's override
 * map, returning only the enabled flag keys. Stale override rows whose key is
 * no longer in the registry are ignored.
 */
export const enabledKeysFromOverrides = (overrides: ReadonlyMap<string, boolean>): string[] =>
  INTERNAL_FEATURE_FLAG_LIST.filter((flag) => overrides.get(flag.key) ?? flag.defaultEnabled).map(
    (flag) => flag.key,
  );

/**
 * Resolve the full catalog (every registry flag) against an org's override map,
 * exposing the code default, the explicit override (or `null`), and the
 * effective `enabled` state. Stale override keys not in the registry are
 * ignored.
 */
/** Reads an override, distinguishing "absent" (`null`) from a stored `false`. */
const overrideFor = (overrides: ReadonlyMap<string, boolean>, key: string): boolean | null => {
  const value = overrides.get(key);
  if (value === undefined) return null;
  return value;
};

export const resolveInternalFeatureFlagList = (
  overrides: ReadonlyMap<string, boolean>,
): ResolvedInternalFeatureFlag[] =>
  INTERNAL_FEATURE_FLAG_LIST.map((flag) => {
    const override = overrideFor(overrides, flag.key);
    return {
      key: flag.key,
      name: flag.name,
      description: flag.description,
      defaultEnabled: flag.defaultEnabled,
      override,
      enabled: override ?? flag.defaultEnabled,
    };
  });

/**
 * `InternalFeatureFlagService` resolves and mutates our OWN (voidhash-internal)
 * feature flags per organization. The available flags and their code defaults
 * come from `INTERNAL_FEATURE_FLAGS` (`@voidhash/rpc`); this service layers
 * per-org overrides stored in `internal_feature_flag_override` on top, applying
 * the rule `enabled = override ?? defaultEnabled`.
 *
 * `Db` is provided by the application root. There is no `AuthSession`
 * dependency — callers (the admin RPC group, the CurrentUser bootstrap, server
 * gating) are responsible for authorization.
 *
 * ⚠️ Distinct from `FeatureFlagService`, which powers the customer-facing
 * feature-flag product.
 */
export class InternalFeatureFlagService extends Context.Service<InternalFeatureFlagService>()(
  "InternalFeatureFlagService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      /** Load an organization's overrides as a `flagKey -> enabled` map. */
      const loadOverrideMap = (organizationId: string) =>
        Effect.gen(function* () {
          const rows = yield* db
            .select({
              flagKey: internalFeatureFlagOverrides.flagKey,
              enabled: internalFeatureFlagOverrides.enabled,
            })
            .from(internalFeatureFlagOverrides)
            .where(eq(internalFeatureFlagOverrides.organizationId, organizationId));
          return new Map(rows.map((row) => [row.flagKey, row.enabled]));
        });

      const resolveEnabledForOrganization = Effect.fn("resolveEnabledForOrganization")(
        function* (organizationId: string) {
          const overrides = yield* loadOverrideMap(organizationId);
          return enabledKeysFromOverrides(overrides);
        },
        (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
      );

      const resolveEnabledForOrganizations = Effect.fn("resolveEnabledForOrganizations")(
        function* (organizationIds: readonly string[]) {
          const result: Record<string, string[]> = {};
          if (organizationIds.length === 0) {
            return result;
          }

          const rows = yield* db
            .select({
              organizationId: internalFeatureFlagOverrides.organizationId,
              flagKey: internalFeatureFlagOverrides.flagKey,
              enabled: internalFeatureFlagOverrides.enabled,
            })
            .from(internalFeatureFlagOverrides)
            .where(inArray(internalFeatureFlagOverrides.organizationId, [...organizationIds]));

          const byOrg = new Map<string, Map<string, boolean>>();
          for (const row of rows) {
            const map = byOrg.get(row.organizationId) ?? new Map<string, boolean>();
            map.set(row.flagKey, row.enabled);
            byOrg.set(row.organizationId, map);
          }

          for (const organizationId of organizationIds) {
            result[organizationId] = enabledKeysFromOverrides(
              byOrg.get(organizationId) ?? new Map(),
            );
          }
          return result;
        },
        (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
      );

      const isEnabled = Effect.fn("isEnabled")(
        function* (organizationId: string, key: InternalFeatureFlagKey) {
          const definition = INTERNAL_FEATURE_FLAG_LIST.find((flag) => flag.key === key);
          if (!definition) {
            return false;
          }
          const row = yield* db
            .select({ enabled: internalFeatureFlagOverrides.enabled })
            .from(internalFeatureFlagOverrides)
            .where(
              and(
                eq(internalFeatureFlagOverrides.organizationId, organizationId),
                eq(internalFeatureFlagOverrides.flagKey, key),
              ),
            )
            .limit(1);
          return row[0]?.enabled ?? definition.defaultEnabled;
        },
        (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
      );

      const listForOrganization = Effect.fn("listForOrganization")(
        function* (organizationId: string) {
          const overrides = yield* loadOverrideMap(organizationId);
          return resolveInternalFeatureFlagList(overrides);
        },
        (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
      );

      const setOverride = Effect.fn("setOverride")(
        function* (organizationId: string, key: string, enabled: boolean) {
          if (!isInternalFeatureFlagKey(key)) {
            return yield* Effect.fail(
              new InternalFeatureFlagServiceError({
                message: `Unknown internal feature flag: ${key}`,
              }),
            );
          }
          const updatedAt = yield* DateTime.nowAsDate;
          yield* db
            .insert(internalFeatureFlagOverrides)
            .values({
              id: generateId("internalFeatureFlagOverride"),
              organizationId,
              flagKey: key,
              enabled,
            })
            .onConflictDoUpdate({
              target: [
                internalFeatureFlagOverrides.organizationId,
                internalFeatureFlagOverrides.flagKey,
              ],
              set: { enabled, updatedAt },
            });
        },
        (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
      );

      const clearOverride = Effect.fn("clearOverride")(
        function* (organizationId: string, key: string) {
          yield* db
            .delete(internalFeatureFlagOverrides)
            .where(
              and(
                eq(internalFeatureFlagOverrides.organizationId, organizationId),
                eq(internalFeatureFlagOverrides.flagKey, key),
              ),
            );
        },
        (effect) => effect.pipe(Effect.catchTags({ EffectDrizzleQueryError: mapDbError })),
      );

      return constant({
        resolveEnabledForOrganization,
        resolveEnabledForOrganizations,
        isEnabled,
        listForOrganization,
        setOverride,
        clearOverride,
      });
    }),
  },
) {
  static layer = Layer.effect(InternalFeatureFlagService)(InternalFeatureFlagService.make);
}

/** Map a drizzle query error to the service's tagged error. */
function mapDbError(error: {
  readonly cause: unknown;
}): Effect.Effect<never, InternalFeatureFlagServiceError> {
  return Effect.fail(new InternalFeatureFlagServiceError({ message: String(error.cause) }));
}
