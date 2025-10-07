import {
  apiKeys,
  asc,
  type ApiKey as DbApiKey,
  desc,
  eq,
  type InsertApiKey
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  ApiKeyNotFoundError,
  ApiKeyServiceError,
  AuthSession
} from '@voidhash/shared';
import { Effect, pipe } from 'effect';
import { createSecretKey as generateSecretKeyFn } from '../utils/api-keys/effect/utils';
import { checkProjectPermission } from '../utils/permissions';

export class ApiKeyService extends Effect.Service<ApiKeyService>()(
  'ApiKeyService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const dbService = yield* Db;

      const _getApiKeyById = dbService.makeQuery((execute, id: string) =>
        execute(
          async (db) =>
            await db.query.apiKeys.findFirst({
              where: eq(apiKeys.id, id)
            })
        )
      );

      const _createApiKeyRecord = dbService.makeQuery(
        (execute, apiKey: InsertApiKey) =>
          execute(async (db) => {
            await db.insert(apiKeys).values(apiKey);
            return { id: apiKey.id };
          })
      );

      const createSecretKey = (input: { projectId: string; name: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            // SECURITY: Authorization check
            yield* checkProjectPermission(
              input.projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to create secret keys for project ${input.projectId}`
            );

            const { rawKey, ...secretKey } = yield* generateSecretKeyFn();

            const apiKeyId = generateId('apiSecretKey');
            yield* _createApiKeyRecord({
              id: apiKeyId,
              projectId: input.projectId,
              name: input.name,
              ...secretKey
            });

            const apiKey = yield* _getApiKeyById(apiKeyId);
            if (!apiKey) {
              return yield* Effect.fail(
                new ApiKeyServiceError({
                  cause: 'API key not found after creation.'
                })
              );
            }

            return {
              ...apiKey,
              rawKey
            };
          }),
          Effect.catchTags({
            DatabaseError: (e) =>
              new ApiKeyServiceError({ cause: String(e.cause) })
          })
        );

      const _getApiKeys = dbService.makeQuery((execute, projectId: string) =>
        execute(
          async (db) =>
            await db.query.apiKeys.findMany({
              where: eq(apiKeys.projectId, projectId),
              orderBy: [desc(apiKeys.isPublic), asc(apiKeys.createdAt)]
            })
        )
      );

      const getApiKeys = (projectId: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;
            // SECURITY: Authorization check
            yield* checkProjectPermission(
              projectId,
              'project:all',
              `User ${session?.user?.id} is not authorized to access api keys for project ${projectId}`
            );
            return yield* _getApiKeys(projectId);
          }),
          Effect.catchTags({
            DatabaseError: (e) =>
              new ApiKeyServiceError({ cause: String(e.cause) })
          })
        );

      const getApiKeyById = (id: string) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const apiKey = yield* _getApiKeyById(id);
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
          Effect.catchTags({
            DatabaseError: (e) =>
              new ApiKeyServiceError({ cause: String(e.cause) })
          })
        );

      const _updateApiKeyRecord = dbService.makeQuery(
        (execute, apiKey: Omit<Partial<DbApiKey>, 'id'> & { id: string }) =>
          execute(async (db) => {
            await db
              .update(apiKeys)
              .set(apiKey)
              .where(eq(apiKeys.id, apiKey.id));
            return { id: apiKey.id };
          })
      );

      const rotateSecretKey = (input: { secretKeyId: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const existingKey = yield* _getApiKeyById(input.secretKeyId);
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

            const { rawKey, ...newKey } = yield* generateSecretKeyFn();
            yield* _updateApiKeyRecord({
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
          }),
          Effect.catchTags({
            DatabaseError: (e) =>
              new ApiKeyServiceError({ cause: String(e.cause) })
          })
        );

      const _deleteApiKeyRecord = dbService.makeQuery((execute, id: string) =>
        execute(async (db) => {
          await db.delete(apiKeys).where(eq(apiKeys.id, id));
          return { id };
        })
      );

      const deleteSecretKey = (input: { secretKeyId: string }) =>
        pipe(
          Effect.gen(function* () {
            const session = yield* AuthSession;

            const existingKey = yield* _getApiKeyById(input.secretKeyId);
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

            yield* _deleteApiKeyRecord(input.secretKeyId);
          }),
          Effect.catchTags({
            DatabaseError: (e) =>
              new ApiKeyServiceError({ cause: String(e.cause) })
          })
        );

      return {
        createSecretKey,
        getApiKeys,
        getApiKeyById,
        rotateSecretKey,
        deleteSecretKey
      } as const;
    })
  }
) {}
