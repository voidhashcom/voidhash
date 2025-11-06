import { apiKeys, eq, type InsertApiKey } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { IntegrationHarness } from '../../testing/integration-harness';
import { hashKey } from '../../utils/api-keys/effect/utils';
import { ApiKeyService } from '../api-keys';

describe.sequential('ApiKeyService happy path', () => {
  test('should create a secret key successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      name: 'Test API Key'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            const secretKey = yield* apiKeyService.createSecretKey(input);
            return secretKey;
          }),
          Effect.provide(ApiKeyService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });
    expect(value).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test API Key'
    });
    expect(value.rawKey).not.toBe(value.key);
    expect(value.end).toBe(value.rawKey.slice(-4));

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(apiKeys)
        .where(eq(apiKeys.projectId, h.resources.project.id));
    });
  });

  test('should get API keys for a project', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            const dbService = yield* Db;

            // Test Api Key
            const unhashedTestKey = 'test-secret-key';
            const hashedTestKey = yield* hashKey(unhashedTestKey);

            const _createApiKeyRecord = dbService.makeQuery(
              (execute, apiKey: InsertApiKey) =>
                execute(async (db) => {
                  await db.insert(apiKeys).values(apiKey);
                  return { id: apiKey.id };
                })
            );

            yield* _createApiKeyRecord({
              id: generateId('test'),
              name: 'Test Secret Key 2',
              key: hashedTestKey,
              createdAt: new Date(),
              updatedAt: new Date(),
              prefix: 'test_',
              end: '1234',
              isPublic: false,
              projectId: h.resources.project.id
            });

            // Api key, different project
            const unhashedDifferentProjectKey = 'test-secret-key-2';
            const hashedDifferentProjectKey = yield* hashKey(
              unhashedDifferentProjectKey
            );
            yield* _createApiKeyRecord({
              id: generateId('test'),
              name: 'Test Secret Key 2',
              key: hashedDifferentProjectKey,
              createdAt: new Date(),
              updatedAt: new Date(),
              prefix: 'test_',
              end: '1234',
              isPublic: false,
              projectId: generateId('test')
            });

            const apiKeysList = yield* apiKeyService.getApiKeys(
              h.resources.project.id
            );

            return apiKeysList;
          }),
          Effect.provide(ApiKeyService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    // Should return the existing secret key from the harness (both secret and publishable) and the new one
    expect(value).toHaveLength(3);
    const secretKey = value.find(
      (key) => key.isPublic === false && key.name === 'Test Secret Key 2'
    );
    expect(secretKey).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Secret Key 2'
    });
    t.onTestFinished(async () => {
      await h.db.primary
        .delete(apiKeys)
        .where(eq(apiKeys.projectId, h.resources.project.id));
    });
  });

  test('should get API key by ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            const apiKey = yield* apiKeyService.getApiKeyById(
              h.resources.secretKey.id
            );
            return apiKey;
          }),
          Effect.provide(ApiKeyService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      id: h.resources.secretKey.id,
      projectId: h.resources.project.id,
      name: 'Test Secret Key'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(apiKeys)
        .where(eq(apiKeys.projectId, h.resources.project.id));
    });
  });

  test('should delete a secret key successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            yield* apiKeyService.deleteSecretKey({
              secretKeyId: h.resources.secretKey.id
            });
            return 'deleted';
          }),
          Effect.provide(ApiKeyService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toBe('deleted');

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(apiKeys)
        .where(eq(apiKeys.projectId, h.resources.project.id));
    });
  });

  test('should rotate a secret key successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            const rotatedKey = yield* apiKeyService.rotateSecretKey({
              secretKeyId: h.resources.secretKey.id
            });
            return rotatedKey;
          }),
          Effect.provide(ApiKeyService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      id: h.resources.secretKey.id,
      projectId: h.resources.project.id,
      name: 'Test Secret Key'
    });
    expect(value.rawKey).not.toBe(h.resources.secretKey.unhashedKey);
    expect(value.end).toBe(value.rawKey.slice(-4));

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(apiKeys)
        .where(eq(apiKeys.projectId, h.resources.project.id));
    });
  });
});
