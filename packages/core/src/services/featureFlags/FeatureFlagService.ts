import { createId } from "@paralleldrive/cuid2";
import { Context, Effect, Layer, Schema } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  FeatureFlagKeyAlreadyExistsError,
  FeatureFlagNotFoundError,
  FeatureFlagOverrideNotFoundError,
  FeatureFlagTargetNotFoundError,
} from "../../domain/featureFlag/FeatureFlag.ts";
import {
  type InsertFeatureFlag,
  type InsertFeatureFlagOverride,
  type InsertFeatureFlagTarget,
  type InsertFeatureFlagVariant,
  type FeatureFlagTypeValue,
  AuditLogAction,
  AuditLogEntityType,
  Db,
  FeatureFlagIdentityType,
  FeatureFlagTargetListType,
  FeatureFlagType,
  and,
  eq,
  featureFlagOverrides,
  featureFlagTargets,
  featureFlagVariants,
  featureFlags,
  isNull,
  personExternalIdentifiers,
  personIdentities,
  persons,
  sql,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";

/**
 * Catch-all service error. Wraps `DbError` (and `SqlError` from transactions)
 * and other infrastructural failures at the public-method boundary so callers
 * see one stable error tag.
 */
export class FeatureFlagServiceError extends Schema.TaggedErrorClass<FeatureFlagServiceError>(
  "FeatureFlagServiceError",
)("FeatureFlagServiceError", { cause: Schema.String }) {}

interface EvaluationResult {
  readonly enabled: boolean;
  readonly flagId: string;
  readonly key: string;
  readonly payload: unknown | null;
  readonly reason: string;
  readonly variantKey: string | null;
}

interface CustomerFeatureFlagVariantInput {
  readonly id?: string;
  readonly label?: string;
  readonly value: unknown;
  readonly weightBps?: number;
}

const isJsonValue = (value: unknown, seen = new WeakSet<object>()): boolean => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    return false;
  }
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, seen))
    : Object.values(value).every((item) => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
};

const validateCustomerVariants = (
  type: FeatureFlagTypeValue,
  variants: ReadonlyArray<CustomerFeatureFlagVariantInput>,
): string | undefined => {
  if (type === FeatureFlagType.Boolean && variants.length > 0) {
    return "Boolean feature flags cannot have variants";
  }

  for (const variant of variants) {
    if (type === FeatureFlagType.String && typeof variant.value !== "string") {
      return "String feature flag variants must have string values";
    }
    if (
      type === FeatureFlagType.Number &&
      (typeof variant.value !== "number" || !Number.isFinite(variant.value))
    ) {
      return "Number feature flag variants must have finite number values";
    }
    if (type === FeatureFlagType.Json && !isJsonValue(variant.value)) {
      return "JSON feature flag variants must contain valid JSON values";
    }
    if (type === FeatureFlagType.Json && variant.label !== undefined) {
      return "JSON feature flag variants cannot have labels";
    }
  }

  return undefined;
};

const distributeVariantWeights = (count: number): number[] => {
  if (count === 0) {
    return [];
  }
  const baseWeight = Math.floor(10000 / count);
  const remainder = 10000 - baseWeight * count;
  return Array.from({ length: count }, (_, index) => baseWeight + (index < remainder ? 1 : 0));
};

/**
 * `owner_type` stamped on the internal feature flag that backs an experiment.
 * `setInternalFlagState` refuses to touch any flag that is not both `internal`
 * and owned by this type, so the internal-edit guard can never be bypassed for
 * a customer flag. Shared with `ExperimentService`, which sets it on creation.
 */
export const EXPERIMENT_FLAG_OWNER_TYPE = "experiment";

/**
 * Stable bucket assignment in `[0, 10000)` derived from a hash of the input —
 * used to pick a rollout slot and a variant slot deterministically per
 * subject. SHA-256 keeps the bucketing stable across processes and Cloudflare
 * isolates without needing a seeded RNG.
 */
const hashToBucket = async (input: string): Promise<number> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const value =
    (hashArray[0]! << 24) | (hashArray[1]! << 16) | (hashArray[2]! << 8) | hashArray[3]!;
  return (value >>> 0) % 10000;
};

const groupByToMap = <T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> => {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) {
      arr.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
};

/**
 * `FeatureFlagService` is the orchestration entry point for the feature-flag
 * aggregate. Surface: list/get/create/update/archive/restore on flags,
 * upsert/archive on targets and overrides, variant replacement, override
 * lookup by flag or by person, and batched evaluation.
 *
 * `AuditLogPort`, `AuthSession`, and `Db` are provided by the application
 * root.
 */
export class FeatureFlagService extends Context.Service<FeatureFlagService>()(
  "FeatureFlagService",
  {
    make: Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      const db = yield* Db;

      const createFlag = Effect.fn("createFlag")(
        function* (input: {
          readonly projectId: string;
          readonly key: string;
          readonly name?: string;
          readonly description?: string;
          readonly type?: FeatureFlagTypeValue;
          readonly variants?: ReadonlyArray<CustomerFeatureFlagVariantInput>;
        }) {
          const session = yield* AuthSession;
          const type = input.type ?? FeatureFlagType.Boolean;
          const variants = input.variants ?? [];

          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", input.key);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to create feature flags for project ${input.projectId}`,
          );

          const validationError = validateCustomerVariants(type, variants);
          if (validationError) {
            return yield* Effect.fail(new FeatureFlagServiceError({ cause: validationError }));
          }

          const requestedWeights = variants.map((variant) => variant.weightBps);
          const weights = requestedWeights.every((weight): weight is number => weight !== undefined)
            ? requestedWeights
            : distributeVariantWeights(variants.length);
          if (weights.length > 0 && weights.reduce((sum, weight) => sum + weight, 0) !== 10000) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Variant weights must sum to 10000, got ${weights.reduce(
                  (sum, weight) => sum + weight,
                  0,
                )}`,
              }),
            );
          }

          const flagId = generateId("featureFlag");
          const salt = createId();

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", flagId);

          const newFlag: InsertFeatureFlag = {
            id: flagId,
            projectId: input.projectId,
            key: input.key,
            name: input.name ?? input.key,
            description: input.description ?? null,
            type,
            enabled: false,
            rolloutBps: 0,
            salt,
            createdByUserId: session?.user?.id ?? null,
            updatedByUserId: session?.user?.id ?? null,
            version: 1,
          };

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const existing = yield* tx.query.featureFlags.findFirst({
                where: {
                  key: input.key,
                  projectId: input.projectId,
                  archivedAt: { isNull: true },
                },
              });
              if (existing) {
                return yield* Effect.fail(new FeatureFlagKeyAlreadyExistsError({ key: input.key }));
              }
              yield* tx.insert(featureFlags).values(newFlag);
              for (const [index, variant] of variants.entries()) {
                const id = generateId("featureFlagVariant");
                yield* tx.insert(featureFlagVariants).values({
                  id,
                  featureFlagId: flagId,
                  key: id,
                  name: variant.label ?? "",
                  payload: variant.value,
                  weightBps: weights[index]!,
                });
              }
            }),
          );

          yield* auditLog.append({
            projectId: input.projectId,
            entityType: AuditLogEntityType.FeatureFlag,
            entityId: flagId,
            action: AuditLogAction.Created,
            changes: { snapshot: newFlag },
          });

          yield* Effect.log(`Created feature flag ${flagId} for project ${input.projectId}`);
          return { id: flagId };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * Create an internal, owner-scoped feature flag — the backing flag for an
       * experiment. Unlike {@link createFlag} it stamps `internal=true` +
       * `ownerType`/`ownerId` and defaults `rolloutBps` to full (assignment is
       * gated by `enabled`, which the owner flips on start). It is server-only:
       * the caller (`ExperimentService`) performs the project permission check.
       */
      const createInternalFlag = Effect.fn("createInternalFlag")(
        function* (input: {
          readonly projectId: string;
          readonly key: string;
          readonly name: string;
          readonly ownerType: string;
          readonly ownerId: string;
          readonly description?: string;
        }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", input.key);

          const flagId = generateId("featureFlag");
          const salt = createId();

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", flagId);

          const newFlag: InsertFeatureFlag = {
            id: flagId,
            projectId: input.projectId,
            key: input.key,
            name: input.name,
            description: input.description ?? null,
            type: FeatureFlagType.Json,
            enabled: false,
            rolloutBps: 10000,
            salt,
            internal: true,
            ownerType: input.ownerType,
            ownerId: input.ownerId,
            createdByUserId: session?.user?.id ?? null,
            updatedByUserId: session?.user?.id ?? null,
            version: 1,
          };

          yield* db.insert(featureFlags).values(newFlag);

          yield* Effect.log(
            `Created internal feature flag ${flagId} owned by ${input.ownerType}:${input.ownerId}`,
          );
          return { id: flagId };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      /**
       * Flip `enabled`/`rolloutBps` on an experiment-owned internal flag,
       * bypassing the {@link updateFlag} internal-edit guard. Asserts the flag
       * is both `internal` and owned by {@link EXPERIMENT_FLAG_OWNER_TYPE} so it
       * can never mutate a customer flag. Called by `ExperimentService` on
       * start/pause.
       */
      const setInternalFlagState = Effect.fn("setInternalFlagState")(
        function* (input: {
          readonly featureFlagId: string;
          readonly enabled?: boolean;
          readonly rolloutBps?: number;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.featureFlagId);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.featureFlagId },
          });
          if (!existingFlag) {
            return yield* Effect.fail(
              new FeatureFlagNotFoundError({ featureFlagId: input.featureFlagId }),
            );
          }
          if (!existingFlag.internal || existingFlag.ownerType !== EXPERIMENT_FLAG_OWNER_TYPE) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Feature flag ${input.featureFlagId} is not an experiment-owned internal flag`,
              }),
            );
          }

          const updates: Record<string, unknown> = {
            version: sql`${featureFlags.version} + 1`,
          };
          if (input.enabled !== undefined) updates.enabled = input.enabled;
          if (input.rolloutBps !== undefined) updates.rolloutBps = input.rolloutBps;

          yield* db
            .update(featureFlags)
            .set(updates)
            .where(eq(featureFlags.id, input.featureFlagId));

          yield* Effect.log(`Set internal flag state for ${input.featureFlagId}`);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const updateFlag = Effect.fn("updateFlag")(
        function* (input: {
          readonly id: string;
          readonly name?: string;
          readonly description?: string | null;
          readonly enabled?: boolean;
          readonly rolloutBps?: number;
          readonly key?: string;
        }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.id);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.id },
            with: {
              targets: { where: { archivedAt: { isNull: true } } },
              overrides: { where: { archivedAt: { isNull: true } } },
              variants: { where: { archivedAt: { isNull: true } } },
            },
          });
          if (!existingFlag) {
            return yield* Effect.fail(new FeatureFlagNotFoundError({ featureFlagId: input.id }));
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          if (existingFlag.internal) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Feature flag ${input.id} is managed internally and cannot be edited directly`,
              }),
            );
          }

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to update feature flag ${input.id}`,
          );

          const updates: Record<string, unknown> = {
            updatedByUserId: session?.user?.id ?? null,
            version: sql`${featureFlags.version} + 1`,
          };
          if (input.name !== undefined) updates.name = input.name;
          if (input.description !== undefined) updates.description = input.description;
          if (input.enabled !== undefined) updates.enabled = input.enabled;
          if (input.rolloutBps !== undefined) updates.rolloutBps = input.rolloutBps;
          if (input.key !== undefined) updates.key = input.key;

          if (input.key && input.key !== existingFlag.key) {
            const keyChange = input.key;
            yield* db.transaction((tx) =>
              Effect.gen(function* () {
                const conflicting = yield* tx.query.featureFlags.findFirst({
                  where: {
                    key: keyChange,
                    projectId: existingFlag.projectId,
                    archivedAt: { isNull: true },
                  },
                });
                if (conflicting && conflicting.id !== input.id) {
                  return yield* Effect.fail(
                    new FeatureFlagKeyAlreadyExistsError({ key: keyChange }),
                  );
                }
                yield* tx.update(featureFlags).set(updates).where(eq(featureFlags.id, input.id));
              }),
            );
          } else {
            yield* db.update(featureFlags).set(updates).where(eq(featureFlags.id, input.id));
          }

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlag,
            entityId: input.id,
            action: AuditLogAction.Updated,
            changes: { before: existingFlag, after: input },
          });

          const updated = yield* db.query.featureFlags.findFirst({
            where: { id: input.id },
            with: {
              targets: { where: { archivedAt: { isNull: true } } },
              overrides: { where: { archivedAt: { isNull: true } } },
              variants: { where: { archivedAt: { isNull: true } } },
            },
          });
          yield* Effect.log(`Updated feature flag ${input.id}`);
          return updated!;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const archiveFlag = Effect.fn("archiveFlag")(
        function* (input: { readonly id: string }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.id);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.id },
          });
          if (!existingFlag) {
            return yield* Effect.fail(new FeatureFlagNotFoundError({ featureFlagId: input.id }));
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          if (existingFlag.internal) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Feature flag ${input.id} is managed internally and cannot be archived directly`,
              }),
            );
          }

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to archive feature flag ${input.id}`,
          );

          yield* db
            .update(featureFlags)
            .set({ archivedAt: new Date() })
            .where(eq(featureFlags.id, input.id));

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlag,
            entityId: input.id,
            action: AuditLogAction.Archived,
          });

          yield* Effect.log(`Archived feature flag ${input.id}`);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const restoreFlag = Effect.fn("restoreFlag")(
        function* (input: { readonly id: string }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.id);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.id },
          });
          if (!existingFlag) {
            return yield* Effect.fail(new FeatureFlagNotFoundError({ featureFlagId: input.id }));
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to restore feature flag ${input.id}`,
          );

          yield* db
            .update(featureFlags)
            .set({ archivedAt: null })
            .where(eq(featureFlags.id, input.id));

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlag,
            entityId: input.id,
            action: AuditLogAction.Restored,
          });

          yield* Effect.log(`Restored feature flag ${input.id}`);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const getFlagById = Effect.fn("getFlagById")(
        function* (input: { readonly id: string }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.id);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const flag = yield* db.query.featureFlags.findFirst({
            where: { id: input.id },
            with: {
              targets: { where: { archivedAt: { isNull: true } } },
              overrides: { where: { archivedAt: { isNull: true } } },
              variants: { where: { archivedAt: { isNull: true } } },
            },
          });
          if (!flag) {
            return yield* Effect.fail(new FeatureFlagNotFoundError({ featureFlagId: input.id }));
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", flag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", flag.key);

          yield* checkProjectPermission(
            flag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to view feature flag ${input.id}`,
          );

          return flag;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const listFlags = Effect.fn("listFlags")(
        function* (input: { readonly projectId: string; readonly includeArchived?: boolean }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to list feature flags for project ${input.projectId}`,
          );

          const includeArchived = input.includeArchived ?? false;
          const results = yield* db.query.featureFlags.findMany({
            where: {
              projectId: input.projectId,
              internal: false,
              ...(includeArchived ? {} : { archivedAt: { isNull: true } }),
            },
            with: {
              variants: {
                columns: { id: true },
                where: { archivedAt: { isNull: true } },
              },
            },
          });

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.count", results.length);

          return results.map((flag) => ({
            ...flag,
            variantCount: flag.variants.length,
            variants: undefined,
          }));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const updateCustomerFlagVariants = Effect.fn("updateCustomerFlagVariants")(
        function* (input: {
          readonly featureFlagId: string;
          readonly variants: ReadonlyArray<CustomerFeatureFlagVariantInput>;
        }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.featureFlagId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.featureFlagId },
            with: {
              variants: { where: { archivedAt: { isNull: true } } },
            },
          });
          if (!existingFlag) {
            return yield* Effect.fail(
              new FeatureFlagNotFoundError({ featureFlagId: input.featureFlagId }),
            );
          }
          if (existingFlag.internal) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Feature flag ${input.featureFlagId} is managed internally and cannot be edited directly`,
              }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);
          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to update variants for feature flag ${input.featureFlagId}`,
          );

          const validationError = validateCustomerVariants(existingFlag.type, input.variants);
          if (validationError) {
            return yield* Effect.fail(new FeatureFlagServiceError({ cause: validationError }));
          }

          const existingById = new Map(
            existingFlag.variants.map((variant) => [variant.id, variant] as const),
          );
          const seenIds = new Set<string>();
          for (const variant of input.variants) {
            if (!variant.id) {
              continue;
            }
            if (seenIds.has(variant.id)) {
              return yield* Effect.fail(
                new FeatureFlagServiceError({
                  cause: `Duplicate variant id '${variant.id}' for flag ${input.featureFlagId}`,
                }),
              );
            }
            if (!existingById.has(variant.id)) {
              return yield* Effect.fail(
                new FeatureFlagServiceError({
                  cause: `Variant '${variant.id}' does not belong to flag ${input.featureFlagId}`,
                }),
              );
            }
            seenIds.add(variant.id);
          }

          const weights = distributeVariantWeights(input.variants.length);
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .delete(featureFlagVariants)
                .where(eq(featureFlagVariants.featureFlagId, input.featureFlagId));

              for (const [index, variant] of input.variants.entries()) {
                const existingVariant = variant.id ? existingById.get(variant.id) : undefined;
                const id = existingVariant?.id ?? generateId("featureFlagVariant");
                yield* tx.insert(featureFlagVariants).values({
                  id,
                  featureFlagId: input.featureFlagId,
                  key: existingVariant?.key ?? id,
                  name: variant.label ?? "",
                  payload: variant.value,
                  weightBps: weights[index]!,
                });
              }

              yield* tx
                .update(featureFlags)
                .set({
                  updatedByUserId: session?.user?.id ?? null,
                  version: sql`${featureFlags.version} + 1`,
                })
                .where(eq(featureFlags.id, input.featureFlagId));
            }),
          );

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlagVariant,
            entityId: input.featureFlagId,
            parentEntityId: input.featureFlagId,
            action: AuditLogAction.Updated,
            changes: { snapshot: { variants: input.variants } },
          });

          yield* Effect.log(
            `Updated ${input.variants.length} variants for feature flag ${input.featureFlagId}`,
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const updateFlagVariants = Effect.fn("updateFlagVariants")(
        function* (input: {
          readonly featureFlagId: string;
          readonly variants: ReadonlyArray<{
            readonly key: string;
            readonly name: string;
            readonly weightBps: number;
            readonly payload?: unknown;
          }>;
        }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.featureFlagId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.featureFlagId },
          });
          if (!existingFlag) {
            return yield* Effect.fail(
              new FeatureFlagNotFoundError({ featureFlagId: input.featureFlagId }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to update variants for feature flag ${input.featureFlagId}`,
          );

          if (input.variants.length > 0) {
            const totalWeight = input.variants.reduce((sum, v) => sum + v.weightBps, 0);
            if (totalWeight !== 10000) {
              return yield* Effect.fail(
                new FeatureFlagServiceError({
                  cause: `Variant weights must sum to 10000, got ${totalWeight}`,
                }),
              );
            }
          }

          const seen = new Set<string>();
          for (const variant of input.variants) {
            if (seen.has(variant.key)) {
              return yield* Effect.fail(
                new FeatureFlagServiceError({
                  cause: `Duplicate variant key '${variant.key}' for flag ${input.featureFlagId}`,
                }),
              );
            }
            seen.add(variant.key);
          }

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .delete(featureFlagVariants)
                .where(eq(featureFlagVariants.featureFlagId, input.featureFlagId));

              for (const variant of input.variants) {
                const record: InsertFeatureFlagVariant = {
                  id: generateId("featureFlagVariant"),
                  featureFlagId: input.featureFlagId,
                  key: variant.key,
                  name: variant.name,
                  weightBps: variant.weightBps,
                  payload: variant.payload ?? null,
                };
                yield* tx.insert(featureFlagVariants).values(record);
              }
            }),
          );

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlagVariant,
            entityId: input.featureFlagId,
            parentEntityId: input.featureFlagId,
            action: AuditLogAction.Updated,
            changes: { snapshot: { variants: input.variants } },
          });

          yield* Effect.log(
            `Updated ${input.variants.length} variants for feature flag ${input.featureFlagId}`,
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
              SqlError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const upsertTarget = Effect.fn("upsertTarget")(
        function* (input: {
          readonly featureFlagId: string;
          readonly listType: number;
          readonly identityType: number;
          readonly identityValue: string;
        }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.featureFlagId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.feature_flag.identity_type",
            input.identityType,
          );
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.featureFlagId },
          });
          if (!existingFlag) {
            return yield* Effect.fail(
              new FeatureFlagNotFoundError({ featureFlagId: input.featureFlagId }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to add targets for feature flag ${input.featureFlagId}`,
          );

          const existing = yield* db.query.featureFlagTargets.findFirst({
            where: {
              featureFlagId: input.featureFlagId,
              listType: input.listType,
              identityType: input.identityType,
              identityValue: input.identityValue,
              archivedAt: { isNull: true },
            },
          });

          let targetId: string;
          if (existing) {
            targetId = existing.id;
          } else {
            targetId = generateId("featureFlagTarget");
            const record: InsertFeatureFlagTarget = {
              id: targetId,
              featureFlagId: input.featureFlagId,
              listType: input.listType,
              identityType: input.identityType,
              identityValue: input.identityValue,
            };
            yield* db.insert(featureFlagTargets).values(record);
          }

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.target.id", targetId);

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlagTarget,
            entityId: targetId,
            parentEntityId: input.featureFlagId,
            action: AuditLogAction.TargetAdded,
          });

          yield* Effect.log(`Upserted target ${targetId} for feature flag ${input.featureFlagId}`);
          return { id: targetId };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const archiveTarget = Effect.fn("archiveTarget")(
        function* (input: { readonly id: string }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.target.id", input.id);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingTarget = yield* db.query.featureFlagTargets.findFirst({
            where: { id: input.id },
          });
          if (!existingTarget) {
            return yield* Effect.fail(new FeatureFlagTargetNotFoundError({ targetId: input.id }));
          }

          yield* Effect.annotateCurrentSpan(
            "voidhash.feature_flag.id",
            existingTarget.featureFlagId,
          );

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: existingTarget.featureFlagId },
          });
          if (!existingFlag) {
            return yield* Effect.fail(new FeatureFlagTargetNotFoundError({ targetId: input.id }));
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to remove targets for feature flag ${existingTarget.featureFlagId}`,
          );

          yield* db
            .update(featureFlagTargets)
            .set({ archivedAt: new Date() })
            .where(eq(featureFlagTargets.id, input.id));

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlagTarget,
            entityId: input.id,
            parentEntityId: existingTarget.featureFlagId,
            action: AuditLogAction.TargetRemoved,
          });

          yield* Effect.log(
            `Archived target ${input.id} for feature flag ${existingTarget.featureFlagId}`,
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const upsertOverride = Effect.fn("upsertOverride")(
        function* (input: {
          readonly featureFlagId: string;
          readonly identityType: number;
          readonly identityValue: string;
          readonly forcedEnabled?: boolean | null;
          readonly forcedVariantKey?: string | null;
          readonly note?: string;
        }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.featureFlagId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.feature_flag.identity_type",
            input.identityType,
          );
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: input.featureFlagId },
          });
          if (!existingFlag) {
            return yield* Effect.fail(
              new FeatureFlagNotFoundError({ featureFlagId: input.featureFlagId }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to set overrides for feature flag ${input.featureFlagId}`,
          );

          const existing = yield* db.query.featureFlagOverrides.findFirst({
            where: {
              featureFlagId: input.featureFlagId,
              identityType: input.identityType,
              identityValue: input.identityValue,
              archivedAt: { isNull: true },
            },
          });

          let overrideId: string;
          if (existing) {
            overrideId = existing.id;
            yield* db
              .update(featureFlagOverrides)
              .set({
                forcedEnabled: input.forcedEnabled,
                forcedVariantKey: input.forcedVariantKey,
                note: input.note,
                updatedByUserId: session?.user?.id ?? null,
              })
              .where(eq(featureFlagOverrides.id, existing.id));
          } else {
            overrideId = generateId("featureFlagOverride");
            const record: InsertFeatureFlagOverride = {
              id: overrideId,
              featureFlagId: input.featureFlagId,
              identityType: input.identityType,
              identityValue: input.identityValue,
              forcedEnabled: input.forcedEnabled ?? null,
              forcedVariantKey: input.forcedVariantKey ?? null,
              note: input.note ?? null,
              createdByUserId: session?.user?.id ?? null,
              updatedByUserId: session?.user?.id ?? null,
            };
            yield* db.insert(featureFlagOverrides).values(record);
          }

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.override.id", overrideId);

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlagOverride,
            entityId: overrideId,
            parentEntityId: input.featureFlagId,
            action: AuditLogAction.OverrideSet,
          });

          yield* Effect.log(
            `Upserted override ${overrideId} for feature flag ${input.featureFlagId}`,
          );
          return { id: overrideId };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const archiveOverride = Effect.fn("archiveOverride")(
        function* (input: { readonly id: string }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.override.id", input.id);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const existingOverride = yield* db.query.featureFlagOverrides.findFirst({
            where: { id: input.id },
          });
          if (!existingOverride) {
            return yield* Effect.fail(
              new FeatureFlagOverrideNotFoundError({ overrideId: input.id }),
            );
          }

          yield* Effect.annotateCurrentSpan(
            "voidhash.feature_flag.id",
            existingOverride.featureFlagId,
          );

          const existingFlag = yield* db.query.featureFlags.findFirst({
            where: { id: existingOverride.featureFlagId },
          });
          if (!existingFlag) {
            return yield* Effect.fail(
              new FeatureFlagOverrideNotFoundError({ overrideId: input.id }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", existingFlag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", existingFlag.key);

          yield* checkProjectPermission(
            existingFlag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to remove overrides for feature flag ${existingOverride.featureFlagId}`,
          );

          yield* db
            .update(featureFlagOverrides)
            .set({ archivedAt: new Date() })
            .where(eq(featureFlagOverrides.id, input.id));

          yield* auditLog.append({
            projectId: existingFlag.projectId,
            entityType: AuditLogEntityType.FeatureFlagOverride,
            entityId: input.id,
            parentEntityId: existingOverride.featureFlagId,
            action: AuditLogAction.OverrideRemoved,
          });

          yield* Effect.log(
            `Archived override ${input.id} for feature flag ${existingOverride.featureFlagId}`,
          );
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const listOverridesByFlag = Effect.fn("listOverridesByFlag")(
        function* (input: { readonly featureFlagId: string }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.id", input.featureFlagId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          const flag = yield* db.query.featureFlags.findFirst({
            where: { id: input.featureFlagId },
          });
          if (!flag) {
            return yield* Effect.fail(
              new FeatureFlagNotFoundError({ featureFlagId: input.featureFlagId }),
            );
          }

          yield* Effect.annotateCurrentSpan("voidhash.project.id", flag.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.key", flag.key);

          yield* checkProjectPermission(
            flag.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to list overrides for feature flag ${input.featureFlagId}`,
          );

          return yield* db.query.featureFlagOverrides.findMany({
            where: {
              featureFlagId: input.featureFlagId,
              archivedAt: { isNull: true },
            },
          });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const listOverridesByPerson = Effect.fn("listOverridesByPerson")(
        function* (input: {
          readonly projectId: string;
          readonly identityType: number;
          readonly identityValue: string;
        }) {
          const session = yield* AuthSession;

          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          yield* Effect.annotateCurrentSpan(
            "voidhash.feature_flag.identity_type",
            input.identityType,
          );
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);

          yield* checkProjectPermission(
            input.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to list overrides for project ${input.projectId}`,
          );

          const results = yield* db
            .select()
            .from(featureFlagOverrides)
            .innerJoin(featureFlags, eq(featureFlagOverrides.featureFlagId, featureFlags.id))
            .where(
              and(
                eq(featureFlags.projectId, input.projectId),
                eq(featureFlagOverrides.identityType, input.identityType),
                eq(featureFlagOverrides.identityValue, input.identityValue),
                isNull(featureFlagOverrides.archivedAt),
                isNull(featureFlags.archivedAt),
              ),
            );
          return results.map((row) => row.feature_flag_override);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const evaluateFlagsBatch = Effect.fn("evaluateFlagsBatch")(
        function* (input: {
          readonly projectId: string;
          readonly keys?: ReadonlyArray<string>;
          readonly personId?: string;
          readonly distinctId?: string;
          readonly email?: string;
          readonly externalIds?: ReadonlyArray<string>;
        }) {
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
          if (input.keys)
            yield* Effect.annotateCurrentSpan(
              "voidhash.feature_flag.requested_key_count",
              input.keys.length,
            );
          if (input.personId)
            yield* Effect.annotateCurrentSpan("voidhash.person.id", input.personId);
          if (input.distinctId)
            yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);

          const flags = yield* db.query.featureFlags.findMany({
            where: {
              projectId: input.projectId,
              archivedAt: { isNull: true },
              ...(input.keys && input.keys.length > 0 ? { key: { in: [...input.keys] } } : {}),
            },
          });

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.count", flags.length);

          if (flags.length === 0) {
            return [] as EvaluationResult[];
          }

          const flagIds = flags.map((f) => f.id);

          const [allTargets, allOverrides, allVariants] = yield* Effect.all([
            db.query.featureFlagTargets.findMany({
              where: {
                featureFlagId: { in: flagIds },
                archivedAt: { isNull: true },
              },
            }),
            db.query.featureFlagOverrides.findMany({
              where: {
                featureFlagId: { in: flagIds },
                archivedAt: { isNull: true },
              },
            }),
            db.query.featureFlagVariants.findMany({
              where: {
                featureFlagId: { in: flagIds },
                archivedAt: { isNull: true },
              },
            }),
          ]);

          const personContext = input.personId
            ? yield* Effect.gen(function* () {
                const [person, distinctIdentities, externalIdentifiers] = yield* Effect.all([
                  db.query.persons.findFirst({
                    where: {
                      id: input.personId!,
                      projectId: input.projectId,
                    },
                  }),
                  db.query.personIdentities.findMany({
                    where: {
                      personId: input.personId!,
                      projectId: input.projectId,
                    },
                  }),
                  db.query.personExternalIdentifiers.findMany({
                    where: {
                      personId: input.personId!,
                      projectId: input.projectId,
                    },
                  }),
                ]);

                return {
                  distinctIds: distinctIdentities.map((identity) => identity.distinctId),
                  email: person?.email ?? undefined,
                  externalIds: externalIdentifiers.map((identifier) => identifier.identifier),
                };
              })
            : undefined;

          const targetsByFlag = groupByToMap(allTargets, (t) => t.featureFlagId);
          const overridesByFlag = groupByToMap(allOverrides, (o) => o.featureFlagId);
          const variantsByFlag = groupByToMap(allVariants, (v) => v.featureFlagId);

          const results = yield* Effect.all(
            flags.map((flag) =>
              Effect.catch(
                Effect.gen(function* () {
                  const targets = targetsByFlag.get(flag.id) ?? [];
                  const overrides = overridesByFlag.get(flag.id) ?? [];
                  const variants = variantsByFlag.get(flag.id) ?? [];

                  if (!flag.enabled) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "disabled",
                      variantKey: null,
                    } satisfies EvaluationResult;
                  }

                  const subjectIdentities: Array<{ type: number; value: string }> = [];
                  const seen = new Set<string>();
                  const pushIdentity = (type: number, value: string | undefined) => {
                    if (!value) return;
                    const key = `${type}:${value}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    subjectIdentities.push({ type, value });
                  };

                  pushIdentity(FeatureFlagIdentityType.PersonId, input.personId);
                  pushIdentity(FeatureFlagIdentityType.DistinctId, input.distinctId);
                  for (const distinctId of personContext?.distinctIds ?? []) {
                    pushIdentity(FeatureFlagIdentityType.DistinctId, distinctId);
                  }
                  pushIdentity(FeatureFlagIdentityType.Email, input.email ?? personContext?.email);
                  for (const externalId of input.externalIds ?? []) {
                    pushIdentity(FeatureFlagIdentityType.ExternalId, externalId);
                  }
                  for (const externalId of personContext?.externalIds ?? []) {
                    pushIdentity(FeatureFlagIdentityType.ExternalId, externalId);
                  }

                  const override = subjectIdentities
                    .map((identity) =>
                      overrides.find(
                        (o) =>
                          o.identityType === identity.type && o.identityValue === identity.value,
                      ),
                    )
                    .find((o) => typeof o !== "undefined");

                  if (override) {
                    if (override.forcedEnabled === false) {
                      return {
                        enabled: false,
                        flagId: flag.id,
                        key: flag.key,
                        payload: null,
                        reason: "override",
                        variantKey: null,
                      } satisfies EvaluationResult;
                    }
                    // A forced variant pins the subject to a specific arm
                    // (QA/tester), bypassing variant bucketing. Checked before
                    // `forcedEnabled === true` so an explicit arm wins over a
                    // plain force-on. Payload is that variant's payload.
                    if (override.forcedVariantKey) {
                      const forcedVariant = variants.find(
                        (v) => v.key === override.forcedVariantKey,
                      );
                      return {
                        enabled: true,
                        flagId: flag.id,
                        key: flag.key,
                        payload: forcedVariant?.payload ?? null,
                        reason: "override",
                        variantKey: override.forcedVariantKey,
                      } satisfies EvaluationResult;
                    }
                    if (override.forcedEnabled === true) {
                      return {
                        enabled: true,
                        flagId: flag.id,
                        key: flag.key,
                        payload: null,
                        reason: "override",
                        variantKey: null,
                      } satisfies EvaluationResult;
                    }
                  }

                  const matchesTarget = (target: (typeof targets)[number]) =>
                    subjectIdentities.some(
                      (id) => target.identityType === id.type && target.identityValue === id.value,
                    );

                  const denyTargets = targets.filter(
                    (t) => t.listType === FeatureFlagTargetListType.Deny,
                  );
                  if (denyTargets.some(matchesTarget)) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "denied",
                      variantKey: null,
                    } satisfies EvaluationResult;
                  }

                  const allowTargets = targets.filter(
                    (t) => t.listType === FeatureFlagTargetListType.Allow,
                  );
                  if (allowTargets.length > 0 && !allowTargets.some(matchesTarget)) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "not-allowed",
                      variantKey: null,
                    } satisfies EvaluationResult;
                  }

                  const subjectKey = input.personId ?? input.distinctId;
                  if (!subjectKey) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "no-identity",
                      variantKey: null,
                    } satisfies EvaluationResult;
                  }

                  const rolloutBucket = yield* Effect.promise(() =>
                    hashToBucket(`${flag.salt}:rollout:${subjectKey}`),
                  );

                  if (rolloutBucket >= flag.rolloutBps) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "rollout",
                      variantKey: null,
                    } satisfies EvaluationResult;
                  }

                  // Sort by `key` (not `id`): variant rows are deleted and
                  // reinserted on every sync (fresh ids), so ordering by id
                  // would shift cumulative-weight boundaries and reassign
                  // already-bucketed subjects. Keys are stable across syncs.
                  const activeVariants = variants
                    .filter((variant) => variant.weightBps > 0)
                    .sort((a, b) => a.key.localeCompare(b.key));

                  if (activeVariants.length > 0) {
                    const variantBucket = yield* Effect.promise(() =>
                      hashToBucket(`${flag.salt}:variant:${subjectKey}`),
                    );

                    let cumulative = 0;
                    for (const variant of activeVariants) {
                      cumulative += variant.weightBps;
                      if (variantBucket < cumulative) {
                        return {
                          enabled: true,
                          flagId: flag.id,
                          key: flag.key,
                          payload: variant.payload ?? null,
                          reason: "rollout",
                          variantKey: variant.key,
                        } satisfies EvaluationResult;
                      }
                    }
                  }

                  return {
                    enabled: true,
                    flagId: flag.id,
                    key: flag.key,
                    payload: null,
                    reason: "rollout",
                    variantKey: null,
                  } satisfies EvaluationResult;
                }),
                () =>
                  Effect.succeed({
                    enabled: false,
                    flagId: flag.id,
                    key: flag.key,
                    payload: null,
                    reason: "error",
                    variantKey: null,
                  } satisfies EvaluationResult),
              ),
            ),
          );

          return results;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new FeatureFlagServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return {
        archiveFlag,
        archiveOverride,
        archiveTarget,
        createFlag,
        createInternalFlag,
        evaluateFlagsBatch,
        getFlagById,
        listFlags,
        listOverridesByFlag,
        listOverridesByPerson,
        restoreFlag,
        setInternalFlagState,
        updateCustomerFlagVariants,
        updateFlag,
        updateFlagVariants,
        upsertOverride,
        upsertTarget,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(FeatureFlagService)(FeatureFlagService.make);
}
