import { Effect } from 'effect';
import { queryKeys } from 'src/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const currentUserOptions = () =>
  eq.queryOptions({
    queryKey: queryKeys.user.getUser(),
    queryFn: () =>
      Effect.gen(function* () {
        yield* Effect.log('Fetching user');
        const user = yield* VoidhashRpc.pipe(
          Effect.flatMap((rpc) => rpc.CurrentUser())
        );
        yield* Effect.log('User fetched');
        return user;
      })
  });
