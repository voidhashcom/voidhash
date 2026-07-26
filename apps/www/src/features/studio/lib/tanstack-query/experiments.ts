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
/** Creates a draft A/B test; everything but the name is authored afterwards. */
export const createExperimentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; name: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreateExperiment(variables)),
    mutationKey: ["createExperiment"],
  });

/**
 * Saves everything the detail page stages — scalars, variants, and each
 * variant's paywall placements — in one request. Sections left `undefined`
 * are untouched.
 */
export const saveExperimentSetupOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      name?: string;
      description?: string | null;
      hypothesis?: string | null;
      primaryMetricEventName?: string | null;
      secondaryMetricEventNames?: string[] | null;
      variants?: Array<{
        id?: string;
        name: string;
        isControl: boolean;
        weightBps: number;
        treatments: Array<{
          paywallLocationId: string;
          paywallId: string;
        }>;
      }>;
    }) => VoidhashRpc.request((rpc) => rpc.SaveExperimentSetup(variables)),
    mutationKey: ["saveExperimentSetup"],
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
