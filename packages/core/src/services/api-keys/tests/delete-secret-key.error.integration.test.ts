import { generateId } from '@voidhash/lib';
import { ApiKeyNotFoundError, AuthSession } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { ApiKeyService } from '../index';

describe.sequential('deleteSecretKey error path', () => {
  test('should fail to delete non-existent secret key', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
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
          Effect.provide(ApiKeyService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(ApiKeyNotFoundError);
  });
});
