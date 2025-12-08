import { Effect } from 'effect';
import { queryKeys } from 'src/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listPaywallsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.paywall.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListPaywalls(options)))
  });

export const createPaywallOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createPaywall'],
    mutationFn: (variables: {
      projectId: string;
      name: string;
      slug: string;
    }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreatePaywall(variables)))
  });
