import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPerksOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListPerks(options))),
    queryKey: queryKeys.perk.list(options),
  });

export const createPerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      projectId: string;
      name: string;
      slug: string;
    }) => VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreatePerk(variables))),
    mutationKey: ["createPerk"],
  });

export const deletePerkOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { perkId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeletePerk(variables))),
    mutationKey: ["deletePerk"],
  });
