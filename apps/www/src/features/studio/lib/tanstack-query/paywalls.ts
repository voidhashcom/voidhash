import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPaywallsOptions = (options: { projectId: string; includeArchived?: boolean }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPaywalls(options)),
    queryKey: queryKeys.paywall.list(options),
  });

export const backfillPaywallThumbnailsOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string }) =>
      VoidhashRpc.request((rpc) => rpc.BackfillPaywallThumbnails(variables)),
    mutationKey: ["backfillPaywallThumbnails"],
  });

export const createPaywallOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; name: string; slug: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreatePaywall(variables)),
    mutationKey: ["createPaywall"],
  });

export const renamePaywallOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { paywallId: string; name: string }) =>
      VoidhashRpc.request((rpc) => rpc.RenamePaywall(variables)),
    mutationKey: ["renamePaywall"],
  });

export const archivePaywallOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { paywallId: string }) =>
      VoidhashRpc.request((rpc) => rpc.ArchivePaywall(variables)),
    mutationKey: ["archivePaywall"],
  });

export const restorePaywallOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { paywallId: string }) =>
      VoidhashRpc.request((rpc) => rpc.RestorePaywall(variables)),
    mutationKey: ["restorePaywall"],
  });

export const deletePaywallOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { paywallId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeletePaywall(variables)),
    mutationKey: ["deletePaywall"],
  });

export const createPaywallReleaseOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { paywallId: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreatePaywallRelease(variables)),
    mutationKey: ["createPaywallRelease"],
  });

export const publishPaywallReleaseOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { releaseId: string }) =>
      VoidhashRpc.request((rpc) => rpc.PublishPaywallRelease(variables)),
    mutationKey: ["publishPaywallRelease"],
  });

export const getPaywallDraftReleaseOptions = (options: { paywallId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetPaywallDraftRelease(options)),
    queryKey: queryKeys.paywall.draft(options),
  });
