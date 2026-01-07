import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const currentUserOptions = () =>
  eq.queryOptions({
    queryFn: () =>
      Effect.gen(function* queryFn() {
        yield* Effect.log("Fetching user");
        const user = yield* VoidhashRpc.pipe(
          Effect.flatMap((rpc) => rpc.CurrentUser())
        );
        yield* Effect.log("User fetched");
        return user;
      }),
    queryKey: queryKeys.user.getUser(),
  });
