import { Effect } from 'effect';
import { queryKeys } from 'src/lib/tanstack-query';
import { eq, VoidhashRpc } from '../effect-query';

export const listApiKeysOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.apiKey.list(options),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.ListApiKeys({
            projectId: options.projectId
          })
        )
      )
  });

export const getApiKeyByIdOptions = (options: { apiKeyId: string }) =>
  eq.queryOptions({
    queryKey: queryKeys.apiKey.getApiKey(options.apiKeyId),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetApiKeyById({ apiKeyId: options.apiKeyId })
        )
      )
  });

export const createSecretKeyOptions = () =>
  eq.mutationOptions({
    mutationKey: ['createSecretKey'],
    mutationFn: (variables: { projectId: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateSecretKey(variables)))
  });

export const rotateSecretKeyOptions = () =>
  eq.mutationOptions({
    mutationKey: ['rotateSecretKey'],
    mutationFn: (variables: { apiKeyId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.RotateSecretKey(variables)))
  });

export const deleteApiKeyOptions = () =>
  eq.mutationOptions({
    mutationKey: ['deleteApiKey'],
    mutationFn: (variables: { apiKeyId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteApiKey(variables)))
  });
