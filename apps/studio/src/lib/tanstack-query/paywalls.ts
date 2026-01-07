import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listPaywallsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.ListPaywalls(options))),
    queryKey: queryKeys.paywall.list(options),
  });

export const createPaywallOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      projectId: string;
      name: string;
      slug: string;
    }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreatePaywall(variables))),
    mutationKey: ["createPaywall"],
  });
