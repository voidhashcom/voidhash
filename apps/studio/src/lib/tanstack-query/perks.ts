import { Effect } from 'effect';
import { queryKeys } from 'src/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listPerksOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.perk.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListPerks(options)))
  });

export const createPerkOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createPerk'],
    mutationFn: (variables: {
      projectId: string;
      name: string;
      slug: string;
    }) => VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreatePerk(variables)))
  });

export const deletePerkOptions = () =>
  eq.mutationOptions({
    mutationKey: ['deletePerk'],
    mutationFn: (variables: { perkId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeletePerk(variables)))
  });
