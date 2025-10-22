import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const currentUserOptions = () =>
  effectQuery.queryOptions({
    queryKey: queryKeys.user.getUser(),
    queryFn: () => VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CurrentUser()))
  });
