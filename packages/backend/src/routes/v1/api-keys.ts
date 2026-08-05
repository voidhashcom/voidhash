import { ApiKey, ApiKeyWithRawKey, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiApiKeyNotFoundError,
  ApiApiKeyServiceError,
} from "@voidhash/api-contracts/errors";
import { ApiKeyService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const ApiKeysGroupLive = HttpApiBuilder.group(VoidhashV1Api, "api_keys", (handlers) =>
  Effect.gen(function* () {
    const apiKeyService = yield* ApiKeyService;
    return handlers
      .handle("createSecretKey", ({ payload }) =>
        bridgeAuthSession(apiKeyService.createSecretKey(payload)).pipe(
          Effect.map((apiKey) => new ApiKeyWithRawKey(apiKey)),
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ApiKeyServiceError: (e) => Effect.fail(new ApiApiKeyServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("listApiKeys", () =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const apiKeys = yield* apiKeyService.getApiKeys(projectId);
            return apiKeys.map(
              (apiKey) =>
                new ApiKey({
                  ...apiKey,
                  ...(apiKey.isPublic ? { rawKey: apiKey.key } : {}),
                }),
            );
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ApiKeyServiceError: (e) => Effect.fail(new ApiApiKeyServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getApiKeyById", ({ params }) =>
        bridgeAuthSession(apiKeyService.getApiKeyById(params.apiKeyId)).pipe(
          Effect.map(
            (apiKey) =>
              new ApiKey({
                ...apiKey,
                ...(apiKey.isPublic ? { rawKey: apiKey.key } : {}),
              }),
          ),
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ApiKeyNotFoundError: (e) =>
              Effect.fail(new ApiApiKeyNotFoundError({ message: e.message })),
            ApiKeyServiceError: (e) => Effect.fail(new ApiApiKeyServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("rotateSecretKey", ({ params }) =>
        bridgeAuthSession(apiKeyService.rotateSecretKey({ secretKeyId: params.apiKeyId })).pipe(
          Effect.map((apiKey) => new ApiKeyWithRawKey(apiKey)),
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ApiKeyNotFoundError: (e) =>
              Effect.fail(new ApiApiKeyNotFoundError({ message: e.message })),
            ApiKeyServiceError: (e) => Effect.fail(new ApiApiKeyServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("deleteApiKey", ({ params }) =>
        bridgeAuthSession(apiKeyService.deleteSecretKey({ secretKeyId: params.apiKeyId })).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ApiKeyNotFoundError: (e) =>
              Effect.fail(new ApiApiKeyNotFoundError({ message: e.message })),
            ApiKeyServiceError: (e) => Effect.fail(new ApiApiKeyServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
