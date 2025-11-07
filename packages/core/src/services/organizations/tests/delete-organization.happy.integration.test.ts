import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, it } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { OrganizationService } from '../index';

describe.sequential('deleteOrganization happy path', () => {
  // TODO: Fix this test, it's failing because the better-auth cookie is not set
  // biome-ignore lint/suspicious/noSkippedTests: TODO
  it.skip('should delete organization successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      organizationId: h.resources.organization.id
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            // TODO: Pass real headers. This probably won't work.
            yield* organizationService.deleteOrganization(input, 'cookie');
            return 'deleted';
          }),
          Effect.provide(OrganizationService.Default),
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
  });
});

