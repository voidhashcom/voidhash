import { apiKeys, eq } from '@voidhash/db';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ApiKeyService } from '../index';

describe.sequential('createSecretKey happy path', () => {
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
});
