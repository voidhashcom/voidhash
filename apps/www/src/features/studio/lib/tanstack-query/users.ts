import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq, managedRuntime } from "../effect-query";

const currentUserEffect = () =>
  VoidhashRpc.request((rpc) =>
    Effect.gen(function* queryFn() {
      yield* Effect.log("Fetching user");
      const user = yield* rpc.CurrentUser();
      yield* Effect.log("User fetched");
      return user;
    }),
  );

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () =>
  managedRuntime.runPromise(currentUserEffect()),
);

export const currentUserOptions = () =>
  eq.queryOptions({
    queryFn: () => currentUserEffect(),
    queryKey: queryKeys.user.getUser(),
  });

export const setUserAvatarOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { imageBase64: string; contentType: string }) =>
      VoidhashRpc.request((rpc) => rpc.SetUserAvatar(variables)),
    mutationKey: ["setUserAvatar"],
  });

export const removeUserAvatarOptions = () =>
  eq.mutationOptions({
    mutationFn: (_variables: void) => VoidhashRpc.request((rpc) => rpc.RemoveUserAvatar()),
    mutationKey: ["removeUserAvatar"],
  });
