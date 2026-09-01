import { ApiKeyService } from "@voidhash/core/services";
import {
  ApiKeyRpcsDef,
  RpcActionForbiddenError,
  RpcApiKeyNotFoundError,
  RpcApiKeyServiceError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";

export const ApiKeyRpcsLive = ApiKeyRpcsDef.toLayer(
  Effect.gen(function* ApiKeyRpcsLive() {
    const apiKeyService = yield* ApiKeyService;
    return {
      CreateSecretKey: ({ projectId, name }) =>
        apiKeyService.createSecretKey({ name, projectId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
      DeleteApiKey: ({ apiKeyId }) =>
        apiKeyService.deleteSecretKey({ secretKeyId: apiKeyId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ApiKeyNotFoundError: (error) =>
              Effect.fail(new RpcApiKeyNotFoundError({ message: error.message })),
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
      GetApiKeyById: ({ apiKeyId }) =>
        apiKeyService.getApiKeyById(apiKeyId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ApiKeyNotFoundError: (error) =>
              Effect.fail(new RpcApiKeyNotFoundError({ message: error.message })),
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
      ListApiKeys: ({ projectId }) =>
        apiKeyService.getApiKeys(projectId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
      RotateSecretKey: ({ apiKeyId }) =>
        apiKeyService.rotateSecretKey({ secretKeyId: apiKeyId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ApiKeyNotFoundError: (error) =>
              Effect.fail(new RpcApiKeyNotFoundError({ message: error.message })),
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
      CreateUserApiKey: ({ name, prefix }) =>
        apiKeyService.createUserApiKey({ name, prefix }).pipe(
          Effect.catchTags({
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
      ListUserApiKeys: () =>
        apiKeyService.listUserApiKeys().pipe(
          Effect.map((keys) =>
            keys.map((key) => ({
              createdAt: key.createdAt,
              enabled: key.enabled,
              end: key.end,
              expiresAt: key.expiresAt,
              id: key.id,
              name: key.name,
              prefix: key.prefix,
            })),
          ),
          Effect.catchTags({
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
      RevokeUserApiKey: ({ userApiKeyId }) =>
        apiKeyService.revokeUserApiKey({ userApiKeyId }).pipe(
          Effect.catchTags({
            ApiKeyNotFoundError: (error) =>
              Effect.fail(new RpcApiKeyNotFoundError({ message: error.message })),
            ApiKeyServiceError: (error) =>
              Effect.fail(new RpcApiKeyServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
