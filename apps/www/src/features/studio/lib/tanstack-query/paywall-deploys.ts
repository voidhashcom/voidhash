import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPaywallDeploysOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPaywallDeploys(options)),
    queryKey: queryKeys.paywallDeploy.list(options),
  });

// `VoidhashRpc.use` (not `.request`) keeps the rpc's typed error union, so
// consumers can match on the namespaced `Rpc/*` failure tags.
export const setActivePaywallReleaseOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { releaseId: string }) =>
      VoidhashRpc.use((rpc) => rpc.SetActivePaywallRelease(variables)),
    mutationKey: ["setActivePaywallRelease"],
  });
