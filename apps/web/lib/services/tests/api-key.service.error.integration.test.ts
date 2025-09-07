import { Environment as EnvironmentEnum } from '@voidhash/lib/constants';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { generateId } from '@/lib/id/generate';
import { createIntegrationTestRunner } from '../../effect/runtimes/integration-test';
import { createMockEnvironment } from '../../testing/__mocks__/environment.mock';
import { IntegrationHarness } from '../../testing/integration-harness';
import { ApiKeyNotFoundError, ApiKeyService } from '../api-key.service';
import { AuthSession } from '../auth.service';
import { Environment } from '../environment.service';

describe.sequential('ApiKeyService error path', () => {
  test('should fail to get API key by non-existent ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentId = generateId('apiSecretKey');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            const apiKey = yield* apiKeyService.getApiKeyById(nonExistentId);
            return apiKey;
          }),
          Effect.provide(ApiKeyService.DefaultWithoutDependencies),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          ),
          Effect.provideService(
            Environment,
            createMockEnvironment(EnvironmentEnum.Production)
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ApiKeyNotFoundError);
  });

  test('should fail to delete non-existent secret key', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentId = generateId('apiSecretKey');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            yield* apiKeyService.deleteSecretKey({
              secretKeyId: nonExistentId
            });
            return 'deleted';
          }),
          Effect.provide(ApiKeyService.DefaultWithoutDependencies),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          ),
          Effect.provideService(
            Environment,
            createMockEnvironment(EnvironmentEnum.Production)
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ApiKeyNotFoundError);
  });

  test('should fail to rotate non-existent secret key', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentId = generateId('apiSecretKey');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const apiKeyService = yield* ApiKeyService;
            const rotatedKey = yield* apiKeyService.rotateSecretKey({
              secretKeyId: nonExistentId
            });
            return rotatedKey;
          }),
          Effect.provide(ApiKeyService.DefaultWithoutDependencies),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          ),
          Effect.provideService(
            Environment,
            createMockEnvironment(EnvironmentEnum.Production)
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ApiKeyNotFoundError);
  });
});
