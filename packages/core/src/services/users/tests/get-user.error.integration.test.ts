import { AuthenticationError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { UserService } from '../index';

describe.sequential('getUser error path', () => {
  test('should fail to get user when not authenticated', async (t) => {
    await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const userService = yield* UserService;
            const user = yield* userService.getUser();
            return user;
          }),
          Effect.provide(UserService.Default)
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(AuthenticationError);
  });
});

