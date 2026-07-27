import { Effect } from "effect";

import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

// Queries
/** Query options for a project's feature flags, with archived records opt-in. */
export const listFeatureFlagsOptions = (options: {
  projectId: string;
  includeArchived?: boolean;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListFeatureFlags(options)),
    queryKey: queryKeys.featureFlag.list({
      includeArchived: options.includeArchived ?? false,
      projectId: options.projectId,
    }),
  });

export const getFeatureFlagOptions = (options: { id: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetFeatureFlag(options)),
    queryKey: queryKeys.featureFlag.getFlag(options.id),
  });

export const listFeatureFlagOverridesByPersonOptions = (options: {
  projectId: string;
  identityType: number;
  identityValue: string;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListFeatureFlagOverridesByPerson(options)),
    queryKey: queryKeys.featureFlag.overridesByPerson(options),
  });

// Mutations
export const createFeatureFlagOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      description?: string;
      projectId: string;
      slug: string;
      type: "boolean" | "string" | "number" | "json";
      variants: Array<{
        label?: string;
        value: unknown;
      }>;
    }) => VoidhashRpc.request((rpc) => rpc.CreateFeatureFlag(variables)),
    mutationKey: ["createFeatureFlag"],
  });

// `use` rather than `request`: it keeps the RPC's error union intact so callers
// can match on it (a duplicate slug reads very differently to a server error).
export const updateFeatureFlagOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      description?: string | null;
      enabled?: boolean;
      rolloutBps?: number;
      slug?: string;
    }) => VoidhashRpc.use((rpc) => rpc.UpdateFeatureFlag(variables)),
    mutationKey: ["updateFeatureFlag"],
  });

export const archiveFeatureFlagOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.ArchiveFeatureFlag(variables)),
    mutationKey: ["archiveFeatureFlag"],
  });

export const restoreFeatureFlagOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.RestoreFeatureFlag(variables)),
    mutationKey: ["restoreFeatureFlag"],
  });

export const upsertFeatureFlagOverrideOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      featureFlagId: string;
      identityType: number;
      identityValue: string;
      forcedEnabled?: boolean | null;
      note?: string;
    }) => VoidhashRpc.request((rpc) => rpc.UpsertFeatureFlagOverride(variables)),
    mutationKey: ["upsertFeatureFlagOverride"],
  });

export const archiveFeatureFlagOverrideOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.ArchiveFeatureFlagOverride(variables)),
    mutationKey: ["archiveFeatureFlagOverride"],
  });

export const upsertFeatureFlagTargetOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      featureFlagId: string;
      listType: number;
      identityType: number;
      identityValue: string;
    }) => VoidhashRpc.request((rpc) => rpc.UpsertFeatureFlagTarget(variables)),
    mutationKey: ["upsertFeatureFlagTarget"],
  });

export const archiveFeatureFlagTargetOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.ArchiveFeatureFlagTarget(variables)),
    mutationKey: ["archiveFeatureFlagTarget"],
  });

export const updateFeatureFlagVariantsOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      featureFlagId: string;
      variants: Array<{
        id?: string;
        label?: string;
        value: unknown;
      }>;
    }) => VoidhashRpc.request((rpc) => rpc.UpdateFeatureFlagVariants(variables)),
    mutationKey: ["updateFeatureFlagVariants"],
  });

/**
 * Commits everything staged on the flag detail screen in one request: the flag's
 * own fields, the full variant list, then target and override removals and
 * additions. Only the parts the caller passes are touched.
 *
 * Removals run before additions so re-adding an identity that was removed in the
 * same batch ends up live rather than archived. `use` rather than `request`
 * keeps the RPC error union intact for callers that report typed failures.
 */
export const saveFeatureFlagDraftOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      addedOverrides: ReadonlyArray<{
        forcedEnabled: boolean | null;
        identityType: number;
        identityValue: string;
        note?: string;
      }>;
      addedTargets: ReadonlyArray<{
        identityType: number;
        identityValue: string;
        listType: number;
      }>;
      archivedOverrideIds: ReadonlyArray<string>;
      archivedTargetIds: ReadonlyArray<string>;
      flag?: {
        description?: string | null;
        enabled?: boolean;
        rolloutBps?: number;
      };
      id: string;
      variants?: ReadonlyArray<{
        id?: string;
        label?: string;
        value: unknown;
      }>;
    }) =>
      VoidhashRpc.use((rpc) =>
        Effect.gen(function* () {
          if (variables.flag) {
            yield* rpc.UpdateFeatureFlag({ id: variables.id, ...variables.flag });
          }

          if (variables.variants) {
            yield* rpc.UpdateFeatureFlagVariants({
              featureFlagId: variables.id,
              variants: variables.variants,
            });
          }

          for (const id of variables.archivedTargetIds) {
            yield* rpc.ArchiveFeatureFlagTarget({ id });
          }
          for (const target of variables.addedTargets) {
            yield* rpc.UpsertFeatureFlagTarget({ featureFlagId: variables.id, ...target });
          }

          for (const id of variables.archivedOverrideIds) {
            yield* rpc.ArchiveFeatureFlagOverride({ id });
          }
          for (const override of variables.addedOverrides) {
            yield* rpc.UpsertFeatureFlagOverride({ featureFlagId: variables.id, ...override });
          }
        }),
      ),
    mutationKey: ["saveFeatureFlagDraft"],
  });
