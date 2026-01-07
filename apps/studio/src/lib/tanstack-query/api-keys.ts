import { Effect } from "effect";
import { queryKeys } from "src/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export const listApiKeysOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListApiKeys({
            projectId: options.projectId,
          })
        )
      ),
    queryKey: queryKeys.apiKey.list(options),
  });

export const getApiKeyByIdOptions = (options: { apiKeyId: string }) =>
  eq.queryOptions({
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetApiKeyById({ apiKeyId: options.apiKeyId })
        )
      ),
    queryKey: queryKeys.apiKey.getApiKey(options.apiKeyId),
  });

export const createSecretKeyOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { projectId: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateSecretKey(variables))),
    mutationKey: ["createSecretKey"],
  });

export const rotateSecretKeyOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { apiKeyId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.RotateSecretKey(variables))),
    mutationKey: ["rotateSecretKey"],
  });

export const deleteApiKeyOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { apiKeyId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteApiKey(variables))),
    mutationKey: ["deleteApiKey"],
  });
