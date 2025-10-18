import { ApiKeyService } from '@voidhash/core/services';
import { extractAuthorizedProjectId } from '@voidhash/core/utils';
import { ApiKeyRpcsDef } from '@voidhash/rpc';
import { AuthSession } from '@voidhash/shared';
import { Effect, Layer } from 'effect';

export const ApiKeyRpcsLive = ApiKeyRpcsDef.toLayer(
  Effect.gen(function* () {
    const apiKeyService = yield* ApiKeyService;
    return {
      CreateSecretKey: ({ projectId, name }) =>
        apiKeyService.createSecretKey({ projectId, name }),
      ListApiKeys: () =>
        Effect.gen(function* () {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          return yield* apiKeyService.getApiKeys(projectId);
        }),
      GetApiKeyById: ({ apiKeyId }) => apiKeyService.getApiKeyById(apiKeyId),
      RotateSecretKey: ({ apiKeyId }) =>
        apiKeyService.rotateSecretKey({ secretKeyId: apiKeyId }),
      DeleteApiKey: ({ apiKeyId }) =>
        apiKeyService.deleteSecretKey({ secretKeyId: apiKeyId })
    };
  })
).pipe(Layer.provide(ApiKeyService.Default));
