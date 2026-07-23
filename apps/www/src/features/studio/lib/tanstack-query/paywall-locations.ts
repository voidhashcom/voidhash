import { Effect } from "effect";
import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPaywallLocationsOptions = (options: {
  projectId: string;
  includeArchived?: boolean;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPaywallLocations(options)),
    queryKey: queryKeys.paywallLocation.list(options),
  });

export const listPaywallLocationShowingsOptions = (options: { locationId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPaywallLocationShowings(options)),
    queryKey: queryKeys.paywallLocation.showings(options),
  });

export const createPaywallLocationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      description?: string;
      name: string;
      projectId: string;
      slug: string;
    }) => VoidhashRpc.request((rpc) => rpc.CreatePaywallLocation(variables)),
    mutationKey: ["createPaywallLocation"],
  });

export const updatePaywallLocationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { description?: string | null; locationId: string; name?: string }) =>
      VoidhashRpc.request((rpc) => rpc.UpdatePaywallLocation(variables)),
    mutationKey: ["updatePaywallLocation"],
  });

export const archivePaywallLocationOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { locationId: string }) =>
      VoidhashRpc.request((rpc) => rpc.ArchivePaywallLocation(variables)),
    mutationKey: ["archivePaywallLocation"],
  });

// `VoidhashRpc.use` (not `.request`) keeps the rpc's typed error union, so
// consumers can match on the namespaced `Rpc/*` failure tags.
export const assignPaywallLocationShowingOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      featureFlagId?: string;
      locationId: string;
      paywallId?: string;
      type: "feature_flag" | "paywall_release";
    }) => VoidhashRpc.use((rpc) => rpc.AssignPaywallLocationShowing(variables)),
    mutationKey: ["assignPaywallLocationShowing"],
  });

export const clearPaywallLocationShowingOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { locationId: string }) =>
      VoidhashRpc.request((rpc) => rpc.ClearPaywallLocationShowing(variables)),
    mutationKey: ["clearPaywallLocationShowing"],
  });
