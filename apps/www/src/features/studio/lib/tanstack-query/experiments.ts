import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

// Queries
/** Query options for a project's A/B tests, with archived records opt-in. */
export const listExperimentsOptions = (options: { projectId: string; includeArchived?: boolean }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListExperiments(options)),
    queryKey: queryKeys.experiment.list({
      includeArchived: options.includeArchived ?? false,
      projectId: options.projectId,
    }),
  });

export const getExperimentOptions = (options: { id: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetExperiment(options)),
    queryKey: queryKeys.experiment.getExperiment(options.id),
  });

// Mutations
export const createExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      projectId: string;
      key: string;
      name: string;
      description?: string;
      hypothesis?: string;
      primaryMetricEventName: string;
      secondaryMetricEventNames?: string[];
    }) => VoidhashRpc.request((rpc) => rpc.CreateExperiment(variables)),
    mutationKey: ["createExperiment"],
  });

export const updateExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      name?: string;
      description?: string | null;
      hypothesis?: string | null;
      primaryMetricEventName?: string;
      secondaryMetricEventNames?: string[] | null;
    }) => VoidhashRpc.request((rpc) => rpc.UpdateExperiment(variables)),
    mutationKey: ["updateExperiment"],
  });

export const replaceExperimentVariantsOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      experimentId: string;
      variants: Array<{
        key: string;
        name: string;
        isControl: boolean;
        weightBps: number;
      }>;
    }) => VoidhashRpc.request((rpc) => rpc.ReplaceExperimentVariants(variables)),
    mutationKey: ["replaceExperimentVariants"],
  });

export const upsertExperimentTreatmentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      experimentId: string;
      variantId: string;
      treatmentType: string;
      config: unknown;
    }) => VoidhashRpc.request((rpc) => rpc.UpsertExperimentTreatment(variables)),
    mutationKey: ["upsertExperimentTreatment"],
  });

export const removeExperimentTreatmentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.RemoveExperimentTreatment(variables)),
    mutationKey: ["removeExperimentTreatment"],
  });

export const startExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.StartExperiment(variables)),
    mutationKey: ["startExperiment"],
  });

export const pauseExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.PauseExperiment(variables)),
    mutationKey: ["pauseExperiment"],
  });

export const concludeExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string; winningVariantId?: string }) =>
      VoidhashRpc.request((rpc) => rpc.ConcludeExperiment(variables)),
    mutationKey: ["concludeExperiment"],
  });

export const archiveExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.ArchiveExperiment(variables)),
    mutationKey: ["archiveExperiment"],
  });

export const restoreExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.RestoreExperiment(variables)),
    mutationKey: ["restoreExperiment"],
  });
