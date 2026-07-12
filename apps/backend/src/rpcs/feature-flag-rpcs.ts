import { FeatureFlagService } from "@voidhash/core/services";
import {
  FeatureFlagRpcsDef,
  RpcActionForbiddenError,
  RpcAuditLogServiceError,
  RpcFeatureFlagKeyAlreadyExistsError,
  RpcFeatureFlagNotFoundError,
  RpcFeatureFlagOverrideNotFoundError,
  RpcFeatureFlagServiceError,
  RpcFeatureFlagTargetNotFoundError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const FeatureFlagRpcsLive = FeatureFlagRpcsDef.toLayer(
  Effect.gen(function* FeatureFlagRpcsLive() {
    const service = yield* FeatureFlagService;
    return {
      ArchiveFeatureFlag: (input) =>
        service.archiveFlag(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      ArchiveFeatureFlagOverride: (input) =>
        service.archiveOverride(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagOverrideNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagOverrideNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      ArchiveFeatureFlagTarget: (input) =>
        service.archiveTarget(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
            FeatureFlagTargetNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagTargetNotFoundError({ message: error.message })),
          }),
        ),
      CreateFeatureFlag: (input) =>
        service.createFlag(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagKeyAlreadyExistsError: (error) =>
              Effect.fail(new RpcFeatureFlagKeyAlreadyExistsError({ key: error.key })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      GetFeatureFlag: ({ id }) =>
        service.getFlagById({ id }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            FeatureFlagNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      ListFeatureFlagOverridesByPerson: (input) =>
        service.listOverridesByPerson(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      ListFeatureFlagOverridesByFlag: (input) =>
        service.listOverridesByFlag(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            FeatureFlagNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      ListFeatureFlags: (input) =>
        service.listFlags(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      RestoreFeatureFlag: (input) =>
        service.restoreFlag(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      UpdateFeatureFlag: (input) =>
        service.updateFlag(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagKeyAlreadyExistsError: (error) =>
              Effect.fail(new RpcFeatureFlagKeyAlreadyExistsError({ key: error.key })),
            FeatureFlagNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      UpdateFeatureFlagVariants: (input) =>
        service
          .updateFlagVariants({
            ...input,
            variants: [...input.variants],
          })
          .pipe(
            Effect.catchTags({
              ActionForbiddenError: (error) =>
                Effect.fail(new RpcActionForbiddenError({ message: error.message })),
              AuditLogPortError: (error) =>
                Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
              FeatureFlagNotFoundError: (error) =>
                Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
              FeatureFlagServiceError: (error) =>
                Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
            }),
          ),
      UpsertFeatureFlagOverride: (input) =>
        service.upsertOverride(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
      UpsertFeatureFlagTarget: (input) =>
        service.upsertTarget(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcAuditLogServiceError({ cause: error.cause })),
            FeatureFlagNotFoundError: (error) =>
              Effect.fail(new RpcFeatureFlagNotFoundError({ message: error.message })),
            FeatureFlagServiceError: (error) =>
              Effect.fail(new RpcFeatureFlagServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
