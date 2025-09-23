import { generateId } from '@voidhash/lib';
import { Effect } from 'effect';
import { ApiKeyRepository } from '../repositories/api-key-repository';
import { createSecretKey as generateSecretKeyFn } from '../utils/api-keys/effect/utils';
import { checkProjectPermission } from '../utils/permissions';
import { AuthSession } from './auth-service';
import { Environment } from './environment-service';
import { ApiKeyNotFoundError } from './errors';

export class ApiKeyService extends Effect.Service<ApiKeyService>()(
  'ApiKeyService',
  {
    dependencies: [ApiKeyRepository.Default],
    effect: Effect.gen(function* () {
      const apiKeyRepository = yield* ApiKeyRepository;
      return {
        createSecretKey: (input: { projectId: string; name: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;
            const apiKeyRepository = yield* ApiKeyRepository;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              input.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create secret keys for project ${input.projectId}`
            );

            const { rawKey, ...secretKey } =
              yield* generateSecretKeyFn(environment);
            const apiKeyId = generateId('apiSecretKey');
            yield* apiKeyRepository.createApiKey({
              id: apiKeyId,
              projectId: input.projectId,
              name: input.name,
              ...secretKey
            });

            const apiKey = yield* apiKeyRepository.getApiKeyById(apiKeyId);
            if (!apiKey) {
              return yield* Effect.fail(
                new ApiKeyNotFoundError({
                  message: 'API key not found'
                })
              );
            }

            return {
              ...apiKey,
              rawKey
            };
          }),

        getApiKeys: (projectId: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const environment = yield* Environment;
            // SECURITY: Authorization check
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access api keys for project ${projectId}`
            );
            const apiKeys = yield* apiKeyRepository.getApiKeys(projectId);
            return apiKeys.filter((key) => key.environment === environment);
          }),

        getApiKeyById: (id: string) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const apiKey = yield* apiKeyRepository.getApiKeyById(id);
            if (!apiKey) {
              return yield* Effect.fail(
                new ApiKeyNotFoundError({
                  message: 'API key not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              apiKey.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access api key ${id} for project ${apiKey.projectId}`
            );

            return apiKey;
          }),

        deleteSecretKey: (input: { secretKeyId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const apiKeyRepository = yield* ApiKeyRepository;

            const existingKey = yield* apiKeyRepository.getApiKeyById(
              input.secretKeyId
            );
            if (!existingKey) {
              return yield* Effect.fail(
                new ApiKeyNotFoundError({
                  message: 'Secret key not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              existingKey.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to delete secret key ${input.secretKeyId} for project ${existingKey.projectId}`
            );

            yield* apiKeyRepository.deleteApiKey(input.secretKeyId);
          }),

        rotateSecretKey: (input: { secretKeyId: string }) =>
          Effect.gen(function* () {
            const session = yield* AuthSession;
            const apiKeyRepository = yield* ApiKeyRepository;

            const existingKey = yield* apiKeyRepository.getApiKeyById(
              input.secretKeyId
            );
            if (!existingKey) {
              return yield* Effect.fail(
                new ApiKeyNotFoundError({
                  message: 'Secret key not found'
                })
              );
            }

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              existingKey.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to rotate secret key ${input.secretKeyId} for project ${existingKey.projectId}`
            );

            const { rawKey, ...newKey } = yield* generateSecretKeyFn(
              existingKey.environment
            );
            yield* apiKeyRepository.updateApiKey({
              id: input.secretKeyId,
              ...newKey,
              updatedAt: new Date(),
              createdAt: new Date()
            });

            return {
              ...existingKey,
              ...newKey,
              rawKey
            };
          })
      };
    })
  }
) {}
