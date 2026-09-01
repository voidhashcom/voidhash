import * as Schema from "effect/Schema";
import {
  createdResponse,
  FeatureFlag,
  FeatureFlagListItem,
  FeatureFlagOverride,
  FeatureFlagTarget,
  FeatureFlagVariant,
  SdkFeatureFlagResult,
  SdkFeatureFlagsResponse,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiFeatureFlagKeyAlreadyExistsError,
  ApiFeatureFlagNotFoundError,
  ApiFeatureFlagOverrideNotFoundError,
  ApiFeatureFlagServiceError,
  ApiFeatureFlagTargetNotFoundError,
} from "@voidhash/api-contracts/errors";
import { FeatureFlagService } from "@voidhash/core/services";
import { paginate, resolveRequestProjectId, sortById } from "@voidhash/core/utils";
import type {
  FeatureFlagOverride as FeatureFlagOverrideRow,
  FeatureFlagTarget as FeatureFlagTargetRow,
  FeatureFlagVariant as FeatureFlagVariantRow,
} from "@voidhash/db";
import { Db } from "@voidhash/db";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/** Credentials allowed on every feature-flag management endpoint. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

const toApiVariant = (variant: FeatureFlagVariantRow) =>
  new FeatureFlagVariant({
    archivedAt: variant.archivedAt,
    createdAt: variant.createdAt,
    featureFlagId: variant.featureFlagId,
    id: variant.id,
    key: variant.key,
    label: variant.name || null,
    updatedAt: variant.updatedAt,
    value: variant.payload ?? null,
    weightBps: variant.weightBps,
  });

const toApiOverride = (override: FeatureFlagOverrideRow) =>
  new FeatureFlagOverride({
    archivedAt: override.archivedAt,
    createdAt: override.createdAt,
    featureFlagId: override.featureFlagId,
    forcedEnabled: override.forcedEnabled,
    forcedVariantKey: override.forcedVariantKey,
    id: override.id,
    identityType: override.identityType,
    identityValue: override.identityValue,
    note: override.note,
    updatedAt: override.updatedAt,
  });

const toApiTarget = (target: FeatureFlagTargetRow) =>
  new FeatureFlagTarget({
    archivedAt: target.archivedAt,
    createdAt: target.createdAt,
    featureFlagId: target.featureFlagId,
    id: target.id,
    identityType: target.identityType,
    identityValue: target.identityValue,
    listType: target.listType,
    updatedAt: target.updatedAt,
  });

const toApiFeatureFlag = (flag: {
  readonly archivedAt: Date | typeof Schema.Null.Type;
  readonly createdAt: Date | typeof Schema.Null.Type;
  readonly description: string | typeof Schema.Null.Type;
  readonly enabled: boolean;
  readonly id: string;
  readonly key: string;
  readonly overrides: ReadonlyArray<FeatureFlagOverrideRow>;
  readonly projectId: string;
  readonly rolloutBps: number;
  readonly targets: ReadonlyArray<FeatureFlagTargetRow>;
  readonly type: "boolean" | "string" | "number" | "json";
  readonly updatedAt: Date | typeof Schema.Null.Type;
  readonly variants: ReadonlyArray<FeatureFlagVariantRow>;
  readonly version: number;
}) =>
  new FeatureFlag({
    archivedAt: flag.archivedAt,
    createdAt: flag.createdAt,
    description: flag.description,
    enabled: flag.enabled,
    id: flag.id,
    overrides: flag.overrides.map(toApiOverride),
    projectId: flag.projectId,
    rolloutBps: flag.rolloutBps,
    slug: flag.key,
    targets: flag.targets.map(toApiTarget),
    type: flag.type,
    updatedAt: flag.updatedAt,
    variants: flag.variants.map(toApiVariant),
    version: flag.version,
  });

/**
 * Feature-flag CRUD, archive/restore, variant replacement and the server-side
 * evaluator. Publishable keys are rejected on every route.
 */
export const FeatureFlagsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "feature_flags",
  (handlers) =>
    Effect.gen(function* () {
      const featureFlagService = yield* FeatureFlagService;
      const dbService = yield* Db;

      return handlers
        .handle("listFeatureFlags", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const flags = yield* featureFlagService.listFlags({
                includeArchived: query.includeArchived === "true",
                projectId,
              });
              const items = flags.map(
                (flag) =>
                  new FeatureFlagListItem({
                    archivedAt: flag.archivedAt,
                    createdAt: flag.createdAt,
                    description: flag.description,
                    enabled: flag.enabled,
                    id: flag.id,
                    projectId: flag.projectId,
                    rolloutBps: flag.rolloutBps,
                    slug: flag.key,
                    type: flag.type,
                    updatedAt: flag.updatedAt,
                    variantCount: flag.variantCount,
                    version: flag.version,
                  }),
              );
              return yield* paginate(
                sortById(items, (item) => item.id),
                (item) => item.id,
                query,
              );
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("createFeatureFlag", ({ payload }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const created = yield* featureFlagService.createFlag({
                description: payload.description,
                key: payload.slug,
                projectId,
                type: payload.type,
                variants: payload.variants,
              });
              // `createFlag` returns only the new id; re-read so the 201 body is
              // the same resource shape `GET /feature-flags/:id` serves.
              const flag = yield* featureFlagService.getFlagById({ id: created.id });
              const featureFlag = toApiFeatureFlag(flag);
              return yield* createdResponse(
                FeatureFlag,
                featureFlag,
                `/feature-flags/${featureFlag.id}`,
              );
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagKeyAlreadyExistsError: (e) =>
                Effect.fail(new ApiFeatureFlagKeyAlreadyExistsError({ key: e.key })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("getFeatureFlag", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const flag = yield* featureFlagService.getFlagById({ id: params.featureFlagId });
              return toApiFeatureFlag(flag);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("updateFeatureFlag", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const flag = yield* featureFlagService.updateFlag({
                ...(payload.description === undefined
                  ? {}
                  : { description: Option.fromNullishOr(payload.description) }),
                enabled: payload.enabled,
                id: params.featureFlagId,
                key: payload.slug,
                rolloutBps: payload.rolloutBps,
              });
              return toApiFeatureFlag(flag);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagKeyAlreadyExistsError: (e) =>
                Effect.fail(new ApiFeatureFlagKeyAlreadyExistsError({ key: e.key })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("archiveFeatureFlag", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              return yield* featureFlagService.archiveFlag({ id: params.featureFlagId });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("restoreFeatureFlag", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              yield* featureFlagService.restoreFlag({ id: params.featureFlagId });
              const flag = yield* featureFlagService.getFlagById({ id: params.featureFlagId });
              return toApiFeatureFlag(flag);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("replaceFeatureFlagVariants", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              yield* featureFlagService.updateCustomerFlagVariants({
                featureFlagId: params.featureFlagId,
                variants: [...payload.variants],
              });
              const flag = yield* featureFlagService.getFlagById({ id: params.featureFlagId });
              return toApiFeatureFlag(flag);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("evaluateProjectFeatureFlags", ({ payload }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);

              // Same subject resolution as `POST /sdk/evaluate-flags`: a bare
              // distinct id is mapped onto its person so identity-linked
              // targets and overrides participate in the evaluation.
              let personId = payload.personId;
              if (!personId && payload.distinctId) {
                const mapping = yield* dbService.query.personIdentities.findFirst({
                  where: { distinctId: payload.distinctId, projectId },
                });
                personId = mapping?.personId;
              }

              const results = yield* featureFlagService.evaluateFlagsBatch({
                distinctId: payload.distinctId,
                email: payload.email,
                externalIds: payload.externalIds,
                keys: payload.keys,
                personId,
                projectId,
              });

              return new SdkFeatureFlagsResponse({
                flags: results.map(
                  (result) =>
                    new SdkFeatureFlagResult({
                      enabled: result.enabled,
                      key: result.key,
                      payload: result.payload,
                      variantKey: result.variantKey,
                    }),
                ),
              });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              EffectDrizzleQueryError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: String(e.message) })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        );
    }),
);

/**
 * Per-subject flag overrides as a flat collection. Publishable keys are
 * rejected on every route.
 */
export const FeatureFlagOverridesGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "feature_flag_overrides",
  (handlers) =>
    Effect.gen(function* () {
      const featureFlagService = yield* FeatureFlagService;

      return handlers
        .handle("listFeatureFlagOverrides", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagOverridesGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);

              // The two supported read patterns map onto two different service
              // methods: by flag, or by subject identity across all flags.
              const overrides = yield* Effect.fn("overrides")(function* () {
                if (query.featureFlagId !== undefined) {
                  return yield* featureFlagService.listOverridesByFlag({
                    featureFlagId: query.featureFlagId,
                  });
                }
                if (query.identityType !== undefined && query.identityValue !== undefined) {
                  const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
                  return yield* featureFlagService.listOverridesByPerson({
                    identityType: query.identityType,
                    identityValue: query.identityValue,
                    projectId,
                  });
                }
                return yield* Effect.fail(
                  new ApiActionForbiddenError({
                    message:
                      "Provide either featureFlagId, or both identityType and identityValue.",
                  }),
                );
              })();

              const items = sortById(overrides.map(toApiOverride), (item) => item.id);
              return yield* paginate(items, (item) => item.id, query);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("upsertFeatureFlagOverride", ({ payload }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagOverridesGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const upserted = yield* featureFlagService.upsertOverride({
                featureFlagId: payload.featureFlagId,
                ...(payload.forcedEnabled === undefined
                  ? {}
                  : { forcedEnabled: Option.fromNullishOr(payload.forcedEnabled) }),
                ...(payload.forcedVariantKey === undefined
                  ? {}
                  : { forcedVariantKey: Option.fromNullishOr(payload.forcedVariantKey) }),
                identityType: payload.identityType,
                identityValue: payload.identityValue,
                note: payload.note,
              });
              // `upsertOverride` returns only the id; re-read the row so create
              // and update responses carry the same body.
              const overrides = yield* featureFlagService.listOverridesByFlag({
                featureFlagId: payload.featureFlagId,
              });
              const override = overrides.find((candidate) => candidate.id === upserted.id);
              if (!override) {
                return yield* Effect.fail(
                  new ApiFeatureFlagOverrideNotFoundError({ overrideId: upserted.id }),
                );
              }
              return toApiOverride(override);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("archiveFeatureFlagOverride", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagOverridesGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              return yield* featureFlagService.archiveOverride({ id: params.overrideId });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagOverrideNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagOverrideNotFoundError({ overrideId: e.overrideId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        );
    }),
);

/**
 * Allow/deny target lists for a flag. Publishable keys are rejected on every
 * route.
 */
export const FeatureFlagTargetsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "feature_flag_targets",
  (handlers) =>
    Effect.gen(function* () {
      const featureFlagService = yield* FeatureFlagService;

      return handlers
        .handle("listFeatureFlagTargets", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagTargetsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              // Targets are only ever read through their owning flag, which is
              // also where the project permission check happens.
              const flag = yield* featureFlagService.getFlagById({ id: query.featureFlagId });
              const targets = flag.targets.filter(
                (target) => query.listType === undefined || target.listType === query.listType,
              );
              const items = sortById(targets.map(toApiTarget), (item) => item.id);
              return yield* paginate(items, (item) => item.id, query);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("upsertFeatureFlagTarget", ({ payload }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagTargetsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              const upserted = yield* featureFlagService.upsertTarget({
                featureFlagId: payload.featureFlagId,
                identityType: payload.identityType,
                identityValue: payload.identityValue,
                listType: payload.listType,
              });
              // `upsertTarget` returns only the id; re-read through the flag so
              // create and update responses carry the same body.
              const flag = yield* featureFlagService.getFlagById({ id: payload.featureFlagId });
              const target = flag.targets.find((candidate) => candidate.id === upserted.id);
              if (!target) {
                return yield* Effect.fail(
                  new ApiFeatureFlagTargetNotFoundError({ targetId: upserted.id }),
                );
              }
              return toApiTarget(target);
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagNotFoundError({ featureFlagId: e.featureFlagId })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
            }),
          ),
        )
        .handle("archiveFeatureFlagTarget", ({ params }) =>
          bridgeAuthSession(
            Effect.fn("FeatureFlagTargetsGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
              return yield* featureFlagService.archiveTarget({ id: params.targetId });
            })(),
          ).pipe(
            Effect.catchTags({
              ActionForbiddenError: (e) =>
                Effect.fail(new ApiActionForbiddenError({ message: e.message })),
              AuditLogPortError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagServiceError: (e) =>
                Effect.fail(new ApiFeatureFlagServiceError({ cause: e.cause })),
              FeatureFlagTargetNotFoundError: (e) =>
                Effect.fail(new ApiFeatureFlagTargetNotFoundError({ targetId: e.targetId })),
            }),
          ),
        );
    }),
);
