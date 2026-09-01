import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiFeatureFlagKeyAlreadyExistsError,
  ApiFeatureFlagNotFoundError,
  ApiFeatureFlagOverrideNotFoundError,
  ApiFeatureFlagServiceError,
  ApiFeatureFlagTargetNotFoundError,
} from "../errors/FeatureFlag.ts";
import { ApiActionForbiddenError } from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import { paginated } from "../Pagination.ts";
import { SdkFeatureFlagsResponse } from "../Schema.ts";
import {
  CreateFeatureFlagBody,
  EvaluateProjectFeatureFlagsBody,
  FeatureFlag,
  FeatureFlagListItem,
  FeatureFlagOverride,
  FeatureFlagTarget,
  ListFeatureFlagOverridesParams,
  ListFeatureFlagsParams,
  ListFeatureFlagTargetsParams,
  ReplaceFeatureFlagVariantsBody,
  UpdateFeatureFlagBody,
  UpsertFeatureFlagOverrideBody,
  UpsertFeatureFlagTargetBody,
} from "../schemas/feature-flags.ts";

/**
 * Feature-flag management. Every endpoint requires a secret key or a user
 * credential (`x-api-key` / session cookie); publishable keys are rejected.
 */
export const FeatureFlagsGroup = HttpApiGroup.make("feature_flags")
  .add(
    /** Lists the project's customer-owned flags. Internal flags are never returned. */
    HttpApiEndpoint.get("listFeatureFlags", "/", {
      query: ListFeatureFlagsParams,
      success: paginated(FeatureFlagListItem),
      error: [ApiActionForbiddenError, ApiFeatureFlagServiceError],
    }),
  )
  .add(
    /** Creates a flag. `variants` are required for non-boolean flag types. */
    HttpApiEndpoint.post("createFeatureFlag", "/", {
      payload: CreateFeatureFlagBody,
      success: FeatureFlag.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiFeatureFlagKeyAlreadyExistsError,
        ApiFeatureFlagNotFoundError,
        ApiFeatureFlagServiceError,
      ],
    }),
  )
  .add(
    /** Reads one flag with its variants, targets and active overrides inlined. */
    HttpApiEndpoint.get("getFeatureFlag", "/:featureFlagId", {
      params: { featureFlagId: Schema.String },
      success: FeatureFlag,
      error: [ApiActionForbiddenError, ApiFeatureFlagNotFoundError, ApiFeatureFlagServiceError],
    }),
  )
  .add(
    /** Updates flag metadata, its enabled state, or its rollout percentage. */
    HttpApiEndpoint.patch("updateFeatureFlag", "/:featureFlagId", {
      params: { featureFlagId: Schema.String },
      payload: UpdateFeatureFlagBody,
      success: FeatureFlag,
      error: [
        ApiActionForbiddenError,
        ApiFeatureFlagKeyAlreadyExistsError,
        ApiFeatureFlagNotFoundError,
        ApiFeatureFlagServiceError,
      ],
    }),
  )
  .add(
    /** Archives a flag. Evaluation stops returning it; the row is retained. */
    HttpApiEndpoint.delete("archiveFeatureFlag", "/:featureFlagId", {
      params: { featureFlagId: Schema.String },
      error: [ApiActionForbiddenError, ApiFeatureFlagNotFoundError, ApiFeatureFlagServiceError],
    }),
  )
  .add(
    /** Restores a previously archived flag. */
    HttpApiEndpoint.post("restoreFeatureFlag", "/:featureFlagId/restore", {
      params: { featureFlagId: Schema.String },
      success: FeatureFlag,
      error: [ApiActionForbiddenError, ApiFeatureFlagNotFoundError, ApiFeatureFlagServiceError],
    }),
  )
  .add(
    /** Replaces the flag's whole variant matrix; omitted variants are archived. */
    HttpApiEndpoint.put("replaceFeatureFlagVariants", "/:featureFlagId/variants", {
      params: { featureFlagId: Schema.String },
      payload: ReplaceFeatureFlagVariantsBody,
      success: FeatureFlag,
      error: [ApiActionForbiddenError, ApiFeatureFlagNotFoundError, ApiFeatureFlagServiceError],
    }),
  )
  .add(
    /**
     * Evaluates the project's flags for one subject, server side. Same
     * evaluator as `POST /sdk/evaluate-flags`, but the subject is named in the
     * body instead of being taken from a publishable-key session.
     */
    HttpApiEndpoint.post("evaluateProjectFeatureFlags", "/evaluate", {
      payload: EvaluateProjectFeatureFlagsBody,
      success: SdkFeatureFlagsResponse,
      error: [ApiActionForbiddenError, ApiFeatureFlagServiceError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/feature-flags");

/**
 * Per-subject flag overrides, exposed as a flat collection because the primary
 * read pattern ("what is pinned for this person?") crosses flags. Secret key or
 * user credential only.
 */
export const FeatureFlagOverridesGroup = HttpApiGroup.make("feature_flag_overrides")
  .add(
    /**
     * Lists overrides, filtered either by `featureFlagId` or by the identity
     * pair `identityType` + `identityValue`. One of the two is required.
     */
    HttpApiEndpoint.get("listFeatureFlagOverrides", "/", {
      query: ListFeatureFlagOverridesParams,
      success: paginated(FeatureFlagOverride),
      error: [ApiActionForbiddenError, ApiFeatureFlagNotFoundError, ApiFeatureFlagServiceError],
    }),
  )
  .add(
    /** Upserts an override on `(featureFlagId, identityType, identityValue)`. */
    HttpApiEndpoint.post("upsertFeatureFlagOverride", "/", {
      payload: UpsertFeatureFlagOverrideBody,
      success: FeatureFlagOverride.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiFeatureFlagNotFoundError,
        ApiFeatureFlagOverrideNotFoundError,
        ApiFeatureFlagServiceError,
      ],
    }),
  )
  .add(
    /** Archives an override, returning the subject to normal evaluation. */
    HttpApiEndpoint.delete("archiveFeatureFlagOverride", "/:overrideId", {
      params: { overrideId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiFeatureFlagOverrideNotFoundError,
        ApiFeatureFlagServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/feature-flag-overrides");

/**
 * Allow/deny target lists. Flat collection for symmetry with overrides; secret
 * key or user credential only.
 */
export const FeatureFlagTargetsGroup = HttpApiGroup.make("feature_flag_targets")
  .add(
    /** Lists a flag's targets, optionally narrowed to one `listType`. */
    HttpApiEndpoint.get("listFeatureFlagTargets", "/", {
      query: ListFeatureFlagTargetsParams,
      success: paginated(FeatureFlagTarget),
      error: [ApiActionForbiddenError, ApiFeatureFlagNotFoundError, ApiFeatureFlagServiceError],
    }),
  )
  .add(
    /** Upserts a target on `(featureFlagId, listType, identityType, identityValue)`. */
    HttpApiEndpoint.post("upsertFeatureFlagTarget", "/", {
      payload: UpsertFeatureFlagTargetBody,
      success: FeatureFlagTarget.pipe(HttpApiSchema.status(201)),
      error: [
        ApiActionForbiddenError,
        ApiFeatureFlagNotFoundError,
        ApiFeatureFlagServiceError,
        ApiFeatureFlagTargetNotFoundError,
      ],
    }),
  )
  .add(
    /** Archives a target, removing the subject from the list. */
    HttpApiEndpoint.delete("archiveFeatureFlagTarget", "/:targetId", {
      params: { targetId: Schema.String },
      error: [
        ApiActionForbiddenError,
        ApiFeatureFlagServiceError,
        ApiFeatureFlagTargetNotFoundError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/feature-flag-targets");
