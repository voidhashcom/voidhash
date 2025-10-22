import { Effect } from 'effect';
import { queryKeys } from '@/lib/tanstack-query';
import { effectQuery, VoidhashRpc } from '../effect/effect-query';

export const listApiKeysOptions = (options: { projectId: string }) =>
  effectQuery.queryOptions({
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
  effectQuery.queryOptions({
    queryKey: queryKeys.apiKey.getApiKey(options.apiKeyId),
    queryFn: () =>
      VoidhashRpc.pipe(
        Effect.flatMap((rpc) =>
          rpc.GetApiKeyById({ apiKeyId: options.apiKeyId })
        )
      )
  });

export const createSecretKeyOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'createSecretKey',
    mutationFn: (variables: { projectId: string; name: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.CreateSecretKey(variables)))
  });

export const rotateSecretKeyOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'rotateSecretKey',
    mutationFn: (variables: { apiKeyId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.RotateSecretKey(variables)))
  });

export const deleteApiKeyOptions = () =>
  effectQuery.mutationOptions({
    mutationKey: 'deleteApiKey',
    mutationFn: (variables: { apiKeyId: string }) =>
      VoidhashRpc.pipe(Effect.flatMap((rpc) => rpc.DeleteApiKey(variables)))
  });
