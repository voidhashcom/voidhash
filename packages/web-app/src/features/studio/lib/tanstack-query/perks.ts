import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPerksOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPerks(options)),
    queryKey: queryKeys.perk.list(options),
  });

export const createPerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; name: string; slug: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreatePerk(variables)),
    mutationKey: ["createPerk"],
  });

export const deletePerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { perkId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeletePerk(variables)),
    mutationKey: ["deletePerk"],
  });
