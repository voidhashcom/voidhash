import { generateId } from '@voidhash/lib';
import { AuthSession, OrganizationNotFoundError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { OrganizationService } from '../index';

describe.sequential('updateOrganization error path', () => {
  test('should fail to update non-existent organization', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('test');
    const input = {
      organizationId: nonExistentId,
      name: 'Updated Organization Name'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            // TODO: Pass real headers. This probably won't work.
            yield* organizationService.updateOrganization(input, 'cookie');
            return 'updated';
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

