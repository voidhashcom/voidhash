import { ApiKeyService } from "@voidhash/core/services";
import { ApiKeyRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const ApiKeyRpcsLive = ApiKeyRpcsDef.toLayer(
  Effect.gen(function* ApiKeyRpcsLive() {
    const apiKeyService = yield* ApiKeyService;
    return {
      CreateSecretKey: ({ projectId, name }) =>
        apiKeyService.createSecretKey({ name, projectId }),
      DeleteApiKey: ({ apiKeyId }) =>
        apiKeyService.deleteSecretKey({ secretKeyId: apiKeyId }),
      GetApiKeyById: ({ apiKeyId }) => apiKeyService.getApiKeyById(apiKeyId),
      ListApiKeys: ({ projectId }) =>
        Effect.gen(function* ListApiKeys() {
          return yield* apiKeyService.getApiKeys(projectId);
        }),
      RotateSecretKey: ({ apiKeyId }) =>
        apiKeyService.rotateSecretKey({ secretKeyId: apiKeyId }),
    };
  })
).pipe(Layer.provide(ApiKeyService.Default));
