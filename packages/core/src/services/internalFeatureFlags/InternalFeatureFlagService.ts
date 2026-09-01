import * as Arr from "effect/Array";
import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";

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
  /** The explicit per-org override, or `None` when falling back to the default. */
  readonly override: Option.Option<boolean>;
  /** The effective on/off state: `override ?? defaultEnabled`. */
  readonly enabled: boolean;
}

/**
 * Resolve the effective state for every registry flag given an org's override
 * map, returning only the enabled flag keys. Stale override rows whose key is
 * no longer in the registry are ignored.
 */
export const enabledKeysFromOverrides = (overrides: HashMap.HashMap<string, boolean>): string[] =>
  INTERNAL_FEATURE_FLAG_LIST.filter((flag) =>
    Option.getOrElse(HashMap.get(overrides, flag.key), () => flag.defaultEnabled),
  ).map((flag) => flag.key);

/**
 * Resolve the full catalog (every registry flag) against an org's override map,
 * exposing the code default, the explicit override (or `None`), and the
 * effective `enabled` state. Stale override keys not in the registry are
 * ignored.
 */
/** Reads an override, distinguishing absence from a stored `false`. */
const overrideFor = (
  overrides: HashMap.HashMap<string, boolean>,
  key: string,
): Option.Option<boolean> => HashMap.get(overrides, key);

export const resolveInternalFeatureFlagList = (
  overrides: HashMap.HashMap<string, boolean>,
): ResolvedInternalFeatureFlag[] =>
  INTERNAL_FEATURE_FLAG_LIST.map((flag) => {
    const override = overrideFor(overrides, flag.key);
    return {
      key: flag.key,
      name: flag.name,
      description: flag.description,
      defaultEnabled: flag.defaultEnabled,
      override,
      enabled: Option.getOrElse(override, () => flag.defaultEnabled),
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
      const loadOverrideMap = Effect.fn("InternalFeatureFlagService.loadOverrideMap")(function* (
        organizationId: string,
      ) {
        const rows = yield* db
          .select({
            flagKey: internalFeatureFlagOverrides.flagKey,
            enabled: internalFeatureFlagOverrides.enabled,
          })
          .from(internalFeatureFlagOverrides)
          .where(eq(internalFeatureFlagOverrides.organizationId, organizationId));
        return HashMap.fromIterable(rows.map((row) => constant([row.flagKey, row.enabled])));
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
          if (Arr.isReadonlyArrayEmpty(organizationIds)) {
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

          const byOrg = Arr.reduce(
            rows,
            HashMap.empty<string, HashMap.HashMap<string, boolean>>(),
            (grouped, row) =>
              HashMap.modifyAt(grouped, row.organizationId, (current) =>
                Option.some(
                  HashMap.set(
                    Option.getOrElse(current, () => HashMap.empty()),
                    row.flagKey,
                    row.enabled,
                  ),
                ),
              ),
          );

          return R.fromEntries(
            organizationIds.map((organizationId) =>
              constant([
                organizationId,
                enabledKeysFromOverrides(
                  Option.getOrElse(HashMap.get(byOrg, organizationId), () => HashMap.empty()),
                ),
              ]),
            ),
          );
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
