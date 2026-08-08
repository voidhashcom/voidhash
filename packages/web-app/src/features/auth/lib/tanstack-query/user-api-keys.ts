import { VoidhashRpc, eq } from "@/lib/effect-query";

import { queryKeys } from "./query-keys";

export const createUserApiKeyOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { name: string; prefix: string }) =>
      VoidhashRpc.request((rpc) => rpc.CreateUserApiKey(variables)),
    mutationKey: ["createUserApiKey"],
  });

export const revokeUserApiKeyOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { userApiKeyId: string }) =>
      VoidhashRpc.request((rpc) => rpc.RevokeUserApiKey(variables)),
    mutationKey: ["revokeUserApiKey"],
  });

export const listUserApiKeysOptions = () =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListUserApiKeys({})),
    queryKey: queryKeys.userApiKey.list(),
  });
