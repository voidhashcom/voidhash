import { Effect } from "effect";
import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

// Queries
export const listFeatureFlagsOptions = (options: {
  projectId: string;
  includeArchived?: boolean;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListFeatureFlags(options)),
    queryKey: queryKeys.featureFlag.list({ projectId: options.projectId }),
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
      projectId: string;
      key: string;
      name: string;
      description?: string;
    }) => VoidhashRpc.request((rpc) => rpc.CreateFeatureFlag(variables)),
    mutationKey: ["createFeatureFlag"],
  });

export const updateFeatureFlagOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      name?: string;
      description?: string | null;
      enabled?: boolean;
      rolloutBps?: number;
      key?: string;
    }) => VoidhashRpc.request((rpc) => rpc.UpdateFeatureFlag(variables)),
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
        key: string;
        name: string;
        payload?: unknown;
        weightBps: number;
      }>;
    }) => VoidhashRpc.request((rpc) => rpc.UpdateFeatureFlagVariants(variables)),
    mutationKey: ["updateFeatureFlagVariants"],
  });
