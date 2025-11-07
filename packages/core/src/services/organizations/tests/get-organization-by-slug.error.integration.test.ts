import { AuthSession, OrganizationNotFoundError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { OrganizationService } from '../index';

describe.sequential('getOrganizationBySlug error path', () => {
  test('should fail to get organization by non-existent slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentSlug = 'non-existent-organization';
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            const organization =
              yield* organizationService.getOrganizationBySlug(nonExistentSlug);
            return organization;
          }),
          Effect.provide(OrganizationService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(OrganizationNotFoundError);
  });
});

