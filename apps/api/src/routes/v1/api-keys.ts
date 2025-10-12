import { HttpApiBuilder } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { ApiKeyService } from '@voidhash/core/services';
import { extractAuthorizedProjectId } from '@voidhash/core/utils';
import { AuthSession } from '@voidhash/shared';
import { Effect } from 'effect';

export const ApiKeysGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'api_keys',
  (handlers) =>
    Effect.gen(function* () {
      const apiKeyService = yield* ApiKeyService;
      return handlers
        .handle('createSecretKey', ({ payload }) =>
          Effect.gen(function* () {
            return yield* apiKeyService.createSecretKey(payload);
          })
        )
        .handle('listApiKeys', () =>
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            return yield* apiKeyService.getApiKeys(projectId);
          })
        )
        .handle('getApiKeyById', ({ path }) =>
          Effect.gen(function* () {
            return yield* apiKeyService.getApiKeyById(path.apiKeyId);
          })
        )
        .handle('rotateSecretKey', ({ path }) =>
          Effect.gen(function* () {
            return yield* apiKeyService.rotateSecretKey({
              secretKeyId: path.apiKeyId
            });
          })
        )
        .handle('deleteApiKey', ({ path }) =>
          Effect.gen(function* () {
            return yield* apiKeyService.deleteSecretKey({
              secretKeyId: path.apiKeyId
            });
          })
        );
    })
);
