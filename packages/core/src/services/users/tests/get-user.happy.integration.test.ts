import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { UserService } from '../index';

describe.sequential('getUser happy path', () => {
  test('should get user successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const userService = yield* UserService;
            const user = yield* userService.getUser();
            return user;
          }),
          Effect.provide(UserService.Default),
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
      id: expect.any(String),
      email: expect.any(String),
      organizations: expect.any(Array),
      projects: expect.any(Array)
    });
    expect(value.organizations.length).toBeGreaterThan(0);
    expect(value.projects.length).toBeGreaterThan(0);
  });
});
