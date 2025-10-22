import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const listPerksOptions = (options: { projectId: string }) =>
  effectQuery.queryOptions({
    queryKey: queryKeys.perk.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListPerks(options)))
  });

export const createPerkOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createPerk',
    mutationFn: (variables: {
      projectId: string;
      name: string;
      slug: string;
    }) => VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreatePerk(variables)))
  });

export const deletePerkOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'deletePerk',
    mutationFn: (variables: { perkId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeletePerk(variables)))
  });
