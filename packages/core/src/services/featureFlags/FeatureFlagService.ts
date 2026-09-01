import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as R from "effect/Record";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import { createId } from "@paralleldrive/cuid2";
import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import { subtle } from "uncrypto";

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
  readonly payload: unknown;
  readonly reason: string;
  readonly variantKey: Option.Option<string>;
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
    P.isString(value) ||
    P.isBoolean(value) ||
    (P.isNumber(value) && Number.isFinite(value))
  ) {
    return true;
  }
  if (!P.isObject(value)) {
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
  let valid = R.values(value).every((item) => isJsonValue(item, seen));
  if (Array.isArray(value)) {
    valid = value.every((item) => isJsonValue(item, seen));
  }
  seen.delete(value);
  return valid;
};

const validateCustomerVariants = (
  type: FeatureFlagTypeValue,
  variants: ReadonlyArray<CustomerFeatureFlagVariantInput>,
): Option.Option<string> => {
  if (type === FeatureFlagType.Boolean && Arr.isReadonlyArrayNonEmpty(variants)) {
    return Option.some("Boolean feature flags cannot have variants");
  }
  const invalid = variants.find((variant) =>
    type === FeatureFlagType.String
      ? !P.isString(variant.value)
      : type === FeatureFlagType.Number
        ? !P.isNumber(variant.value) || !Number.isFinite(variant.value)
        : type === FeatureFlagType.Json
          ? !isJsonValue(variant.value) || variant.label !== undefined
          : false,
  );
  if (!invalid) return Option.none();
  if (type === FeatureFlagType.String)
    return Option.some("String feature flag variants must have string values");
  if (type === FeatureFlagType.Number)
    return Option.some("Number feature flag variants must have finite number values");
  if (!isJsonValue(invalid.value))
    return Option.some("JSON feature flag variants must contain valid JSON values");
  return Option.some("JSON feature flag variants cannot have labels");
};

const distributeVariantWeights = (count: number): number[] => {
  if (count === 0) {
    return [];
  }
  const baseWeight = Math.floor(10000 / count);
  const remainder = 10000 - baseWeight * count;
  return Array.from({ length: count }, (_, index) => {
    if (index < remainder) return baseWeight + 1;
    return baseWeight;
  });
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
const hashToBucket = (input: string): Effect.Effect<number> =>
  promiseOrDie(() => subtle.digest("SHA-256", new TextEncoder().encode(input))).pipe(
    Effect.map((hashBuffer) => {
      const hashArray = new Uint8Array(hashBuffer);
      const [first = 0, second = 0, third = 0, fourth = 0] = hashArray;
      const value = (first << 24) | (second << 16) | (third << 8) | fourth;
      return (value >>> 0) % 10000;
    }),
  );

/** Archived-flag filter fragment: archived rows are excluded unless requested. */
const archivedFilter = (includeArchived: boolean): { archivedAt?: { isNull: true } } => {
  if (includeArchived) return {};
  return { archivedAt: { isNull: true } };
};

/** Key filter fragment: only applied when the caller narrowed the flag keys. */
const keyFilter = (keys: Option.Option<ReadonlyArray<string>>): { key?: { in: string[] } } => {
  if (Option.isSome(keys) && Arr.isReadonlyArrayNonEmpty(keys.value))
    return { key: { in: [...keys.value] } };
  return {};
};

/** Existing variant row for an optional variant id. */
const lookupExistingVariant = <T>(
  existingById: HashMap.HashMap<string, T>,
  id: Option.Option<string>,
): Option.Option<T> => Option.flatMap(id, (variantId) => HashMap.get(existingById, variantId));

const groupByToMap = <T, K>(items: readonly T[], key: (item: T) => K): HashMap.HashMap<K, T[]> =>
  items.reduce(
    (map, item) =>
      HashMap.modifyAt(map, key(item), (current) =>
        Option.some([...Option.getOrElse(current, () => []), item]),
      ),
    HashMap.empty<K, T[]>(),
  );

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
          if (Option.isSome(validationError)) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({ cause: validationError.value }),
            );
          }

          const requestedWeights = variants.map((variant) => variant.weightBps);
          const weights = requestedWeights.every((weight): weight is number => weight !== undefined)
            ? requestedWeights
            : distributeVariantWeights(variants.length);
          if (
            Arr.isReadonlyArrayNonEmpty(weights) &&
            weights.reduce((sum, weight) => sum + weight, 0) !== 10000
          ) {
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

          yield* db.transaction(
            Effect.fn("FeatureFlagService.createFlag.transaction")(function* (tx) {
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
              yield* Effect.forEach(
                variants,
                (variant, index) => {
                  const id = generateId("featureFlagVariant");
                  return tx.insert(featureFlagVariants).values({
                    id,
                    featureFlagId: flagId,
                    key: id,
                    name: variant.label ?? "",
                    payload: variant.value,
                    weightBps: Option.getOrElse(Option.fromUndefinedOr(weights[index]), () => 0),
                  });
                },
                { concurrency: 1, discard: true },
              );
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
          readonly description?: Option.Option<string>;
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
          if (input.description !== undefined)
            updates.description = Option.getOrNull(input.description);
          if (input.enabled !== undefined) updates.enabled = input.enabled;
          if (input.rolloutBps !== undefined) updates.rolloutBps = input.rolloutBps;
          if (input.key !== undefined) updates.key = input.key;

          if (input.key && input.key !== existingFlag.key) {
            const keyChange = input.key;
            yield* db.transaction(
              Effect.fn("FeatureFlagService.updateFlag.transaction")(function* (tx) {
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
          if (!updated) {
            return yield* Effect.fail(new FeatureFlagNotFoundError({ featureFlagId: input.id }));
          }
          return updated;
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
            .set({ archivedAt: yield* DateTime.nowAsDate })
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
              ...archivedFilter(includeArchived),
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
          if (Option.isSome(validationError)) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({ cause: validationError.value }),
            );
          }

          const existingById = HashMap.fromIterable(
            existingFlag.variants.map((variant) => constant([variant.id, variant])),
          );
          const providedIds = input.variants.flatMap((variant) =>
            Option.toArray(Option.fromUndefinedOr(variant.id)),
          );
          const duplicateId = providedIds.find((id, index) => providedIds.indexOf(id) !== index);
          if (duplicateId) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Duplicate variant id '${duplicateId}' for flag ${input.featureFlagId}`,
              }),
            );
          }
          const foreignId = providedIds.find((id) => !HashMap.has(existingById, id));
          if (foreignId) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Variant '${foreignId}' does not belong to flag ${input.featureFlagId}`,
              }),
            );
          }

          const weights = distributeVariantWeights(input.variants.length);
          yield* db.transaction(
            Effect.fn("FeatureFlagService.updateCustomerVariants.transaction")(function* (tx) {
              yield* tx
                .delete(featureFlagVariants)
                .where(eq(featureFlagVariants.featureFlagId, input.featureFlagId));

              yield* Effect.forEach(
                input.variants,
                (variant, index) => {
                  const existingVariant = lookupExistingVariant(
                    existingById,
                    Option.fromUndefinedOr(variant.id),
                  );
                  const id = Option.match(existingVariant, {
                    onNone: () => generateId("featureFlagVariant"),
                    onSome: (row) => row.id,
                  });
                  return tx.insert(featureFlagVariants).values({
                    id,
                    featureFlagId: input.featureFlagId,
                    key: Option.match(existingVariant, {
                      onNone: () => id,
                      onSome: (row) => row.key,
                    }),
                    name: variant.label ?? "",
                    payload: variant.value,
                    weightBps: Option.getOrElse(Option.fromUndefinedOr(weights[index]), () => 0),
                  });
                },
                { concurrency: 1, discard: true },
              );

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

          if (Arr.isReadonlyArrayNonEmpty(input.variants)) {
            const totalWeight = input.variants.reduce((sum, v) => sum + v.weightBps, 0);
            if (totalWeight !== 10000) {
              return yield* Effect.fail(
                new FeatureFlagServiceError({
                  cause: `Variant weights must sum to 10000, got ${totalWeight}`,
                }),
              );
            }
          }

          const variantKeys = input.variants.map((variant) => variant.key);
          const duplicateKey = variantKeys.find((key, index) => variantKeys.indexOf(key) !== index);
          if (duplicateKey) {
            return yield* Effect.fail(
              new FeatureFlagServiceError({
                cause: `Duplicate variant key '${duplicateKey}' for flag ${input.featureFlagId}`,
              }),
            );
          }

          yield* db.transaction(
            Effect.fn("FeatureFlagService.updateFlagVariants.transaction")(function* (tx) {
              yield* tx
                .delete(featureFlagVariants)
                .where(eq(featureFlagVariants.featureFlagId, input.featureFlagId));

              yield* Effect.forEach(
                input.variants,
                (variant) => {
                  const record: InsertFeatureFlagVariant = {
                    id: generateId("featureFlagVariant"),
                    featureFlagId: input.featureFlagId,
                    key: variant.key,
                    name: variant.name,
                    weightBps: variant.weightBps,
                    payload: variant.payload ?? null,
                  };
                  return tx.insert(featureFlagVariants).values(record);
                },
                { concurrency: 1, discard: true },
              );
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

          const targetId = existing?.id ?? generateId("featureFlagTarget");
          if (!existing) {
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
            .set({ archivedAt: yield* DateTime.nowAsDate })
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
          readonly forcedEnabled?: Option.Option<boolean>;
          readonly forcedVariantKey?: Option.Option<string>;
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

          const overrideId = existing?.id ?? generateId("featureFlagOverride");
          if (existing) {
            yield* db
              .update(featureFlagOverrides)
              .set({
                forcedEnabled: input.forcedEnabled
                  ? Option.getOrNull(input.forcedEnabled)
                  : undefined,
                forcedVariantKey: input.forcedVariantKey
                  ? Option.getOrNull(input.forcedVariantKey)
                  : undefined,
                note: input.note,
                updatedByUserId: session?.user?.id ?? null,
              })
              .where(eq(featureFlagOverrides.id, existing.id));
          } else {
            const record: InsertFeatureFlagOverride = {
              id: overrideId,
              featureFlagId: input.featureFlagId,
              identityType: input.identityType,
              identityValue: input.identityValue,
              forcedEnabled: input.forcedEnabled ? Option.getOrNull(input.forcedEnabled) : null,
              forcedVariantKey: input.forcedVariantKey
                ? Option.getOrNull(input.forcedVariantKey)
                : null,
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
            .set({ archivedAt: yield* DateTime.nowAsDate })
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
              ...keyFilter(Option.fromUndefinedOr(input.keys)),
            },
          });

          yield* Effect.annotateCurrentSpan("voidhash.feature_flag.count", flags.length);

          if (Arr.isReadonlyArrayEmpty(flags)) {
            return [];
          }

          const flagIds = flags.map((f) => f.id);

          const [allTargets, allOverrides, allVariants] = yield* Effect.all(
            [
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
            ],
            { concurrency: 1 },
          );

          const personContext = yield* Option.match(Option.fromUndefinedOr(input.personId), {
            onNone: () => Effect.succeed(Option.none()),
            onSome: (personId) =>
              Effect.all(
                [
                  db.query.persons.findFirst({
                    where: {
                      id: personId,
                      projectId: input.projectId,
                    },
                  }),
                  db.query.personIdentities.findMany({
                    where: {
                      personId,
                      projectId: input.projectId,
                    },
                  }),
                  db.query.personExternalIdentifiers.findMany({
                    where: {
                      personId,
                      projectId: input.projectId,
                    },
                  }),
                ],
                { concurrency: 1 },
              ).pipe(
                Effect.map(([person, distinctIdentities, externalIdentifiers]) =>
                  Option.some({
                    distinctIds: distinctIdentities.map((identity) => identity.distinctId),
                    email: Option.fromNullishOr(person?.email),
                    externalIds: externalIdentifiers.map((identifier) => identifier.identifier),
                  }),
                ),
              ),
          });

          const targetsByFlag = groupByToMap(allTargets, (t) => t.featureFlagId);
          const overridesByFlag = groupByToMap(allOverrides, (o) => o.featureFlagId);
          const variantsByFlag = groupByToMap(allVariants, (v) => v.featureFlagId);

          const results = yield* Effect.all(
            flags.map((flag) =>
              Effect.catch(
                Effect.fn("FeatureFlagService.evaluateFlag")(function* () {
                  const targets = Option.getOrElse(HashMap.get(targetsByFlag, flag.id), () => []);
                  const overrides = Option.getOrElse(
                    HashMap.get(overridesByFlag, flag.id),
                    () => [],
                  );
                  const variants = Option.getOrElse(HashMap.get(variantsByFlag, flag.id), () => []);

                  if (!flag.enabled) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "disabled",
                      variantKey: Option.none(),
                    } satisfies EvaluationResult;
                  }

                  const contextDistinctIds = Option.match(personContext, {
                    onNone: () => [],
                    onSome: (context) => context.distinctIds,
                  });
                  const contextExternalIds = Option.match(personContext, {
                    onNone: () => [],
                    onSome: (context) => context.externalIds,
                  });
                  const contextEmail = Option.flatMap(personContext, (context) => context.email);
                  const identityCandidates = [
                    ...Option.toArray(
                      Option.map(Option.fromUndefinedOr(input.personId), (value) => ({
                        type: FeatureFlagIdentityType.PersonId,
                        value,
                      })),
                    ),
                    ...Option.toArray(
                      Option.map(Option.fromUndefinedOr(input.distinctId), (value) => ({
                        type: FeatureFlagIdentityType.DistinctId,
                        value,
                      })),
                    ),
                    ...contextDistinctIds.map((value) => ({
                      type: FeatureFlagIdentityType.DistinctId,
                      value,
                    })),
                    ...Option.toArray(
                      Option.map(
                        Option.orElse(Option.fromUndefinedOr(input.email), () => contextEmail),
                        (value) => ({ type: FeatureFlagIdentityType.Email, value }),
                      ),
                    ),
                    ...(input.externalIds ?? []).map((value) => ({
                      type: FeatureFlagIdentityType.ExternalId,
                      value,
                    })),
                    ...contextExternalIds.map((value) => ({
                      type: FeatureFlagIdentityType.ExternalId,
                      value,
                    })),
                  ];
                  const initialIdentityState: {
                    readonly seen: HashSet.HashSet<string>;
                    readonly identities: Array<{ type: number; value: string }>;
                  } = { seen: HashSet.empty(), identities: [] };
                  const subjectIdentities = identityCandidates.reduce((state, identity) => {
                    const key = `${identity.type}:${identity.value}`;
                    return HashSet.has(state.seen, key)
                      ? state
                      : {
                          seen: HashSet.add(state.seen, key),
                          identities: [...state.identities, identity],
                        };
                  }, initialIdentityState).identities;

                  const override = subjectIdentities
                    .map((identity) =>
                      overrides.find(
                        (o) =>
                          o.identityType === identity.type && o.identityValue === identity.value,
                      ),
                    )
                    .find((o) => !P.isUndefined(o));

                  if (override) {
                    if (override.forcedEnabled === false) {
                      return {
                        enabled: false,
                        flagId: flag.id,
                        key: flag.key,
                        payload: null,
                        reason: "override",
                        variantKey: Option.none(),
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
                        variantKey: Option.some(override.forcedVariantKey),
                      } satisfies EvaluationResult;
                    }
                    if (override.forcedEnabled === true) {
                      return {
                        enabled: true,
                        flagId: flag.id,
                        key: flag.key,
                        payload: null,
                        reason: "override",
                        variantKey: Option.none(),
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
                      variantKey: Option.none(),
                    } satisfies EvaluationResult;
                  }

                  const allowTargets = targets.filter(
                    (t) => t.listType === FeatureFlagTargetListType.Allow,
                  );
                  if (
                    Arr.isReadonlyArrayNonEmpty(allowTargets) &&
                    !allowTargets.some(matchesTarget)
                  ) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "not-allowed",
                      variantKey: Option.none(),
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
                      variantKey: Option.none(),
                    } satisfies EvaluationResult;
                  }

                  const rolloutBucket = yield* hashToBucket(`${flag.salt}:rollout:${subjectKey}`);

                  if (rolloutBucket >= flag.rolloutBps) {
                    return {
                      enabled: false,
                      flagId: flag.id,
                      key: flag.key,
                      payload: null,
                      reason: "rollout",
                      variantKey: Option.none(),
                    } satisfies EvaluationResult;
                  }

                  // Sort by `key` (not `id`): variant rows are deleted and
                  // reinserted on every sync (fresh ids), so ordering by id
                  // would shift cumulative-weight boundaries and reassign
                  // already-bucketed subjects. Keys are stable across syncs.
                  const variantKeyOrder: Order.Order<(typeof variants)[number]> = Order.mapInput(
                    Order.String,
                    (variant: (typeof variants)[number]) => variant.key,
                  );
                  const activeVariants = Arr.sort(
                    variants.filter((variant) => variant.weightBps > 0),
                    variantKeyOrder,
                  );

                  if (Arr.isReadonlyArrayNonEmpty(activeVariants)) {
                    const variantBucket = yield* hashToBucket(`${flag.salt}:variant:${subjectKey}`);

                    const initialVariantWeightState: {
                      readonly cumulative: number;
                      readonly weighted: Array<{
                        cumulative: number;
                        variant: (typeof activeVariants)[number];
                      }>;
                    } = { cumulative: 0, weighted: [] };
                    const selected = activeVariants
                      .reduce(
                        (state, variant) => ({
                          cumulative: state.cumulative + variant.weightBps,
                          weighted: [
                            ...state.weighted,
                            { cumulative: state.cumulative + variant.weightBps, variant },
                          ],
                        }),
                        initialVariantWeightState,
                      )
                      .weighted.find((entry) => variantBucket < entry.cumulative);
                    if (selected) {
                      return {
                        enabled: true,
                        flagId: flag.id,
                        key: flag.key,
                        payload: selected.variant.payload ?? null,
                        reason: "rollout",
                        variantKey: Option.some(selected.variant.key),
                      } satisfies EvaluationResult;
                    }
                  }

                  return {
                    enabled: true,
                    flagId: flag.id,
                    key: flag.key,
                    payload: null,
                    reason: "rollout",
                    variantKey: Option.none(),
                  } satisfies EvaluationResult;
                })(),
                () =>
                  Effect.succeed({
                    enabled: false,
                    flagId: flag.id,
                    key: flag.key,
                    payload: null,
                    reason: "error",
                    variantKey: Option.none(),
                  } satisfies EvaluationResult),
              ),
            ),
            { concurrency: 1 },
          );

          return results.map((result) => ({
            ...result,
            variantKey: Option.getOrNull(result.variantKey),
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

      return constant({
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
      });
    }),
  },
) {
  static layer = Layer.effect(FeatureFlagService)(FeatureFlagService.make);
}
import { promiseOrDie } from "../../effect-boundary.ts";
