import { FeatureFlagService } from "@voidhash/core/services";
import type {
  FeatureFlag,
  FeatureFlagOverride,
  FeatureFlagTarget,
  FeatureFlagVariant,
} from "@voidhash/db";
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

const toRpcFeatureFlagVariant = (variant: FeatureFlagVariant) => ({
  archivedAt: variant.archivedAt,
  createdAt: variant.createdAt,
  featureFlagId: variant.featureFlagId,
  id: variant.id,
  label: variant.name || null,
  updatedAt: variant.updatedAt,
  value: variant.payload,
});

const toRpcFeatureFlag = (
  flag: FeatureFlag & {
    readonly overrides: ReadonlyArray<FeatureFlagOverride>;
    readonly targets: ReadonlyArray<FeatureFlagTarget>;
    readonly variants: ReadonlyArray<FeatureFlagVariant>;
  },
) => {
  const { key, name: _name, variants, ...rest } = flag;
  return {
    ...rest,
    slug: key,
    variants: variants.map(toRpcFeatureFlagVariant),
  };
};

const toRpcFeatureFlagListItem = (
  flag: FeatureFlag & { readonly variantCount: number; readonly variants?: undefined },
) => {
  const { key, name: _name, variants: _variants, ...rest } = flag;
  return {
    ...rest,
    slug: key,
  };
};

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
      CreateFeatureFlag: ({ slug, ...input }) =>
        service.createFlag({ ...input, key: slug }).pipe(
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
          Effect.map(toRpcFeatureFlag),
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
          Effect.map((flags) => flags.map(toRpcFeatureFlagListItem)),
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
      UpdateFeatureFlag: ({ slug, ...input }) =>
        service.updateFlag({ ...input, key: slug }).pipe(
          Effect.map(toRpcFeatureFlag),
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
          .updateCustomerFlagVariants({
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
