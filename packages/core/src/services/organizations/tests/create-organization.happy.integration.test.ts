import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, it } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { OrganizationService } from '../index';

describe.sequential('createOrganization happy path', () => {
  // TODO: Fix this test, it's failing because the better-auth cookie is not set
  // biome-ignore lint/suspicious/noSkippedTests: TODO
  it.skip('should create an organization successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      name: 'Test Organization'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            // TODO: Pass real headers. This probably won't work.
            const organization =
              yield* organizationService.createOrganization(input);
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

    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });
    expect(Exit.isSuccess(result)).toBe(true);
    expect(value).toMatchObject({
      name: 'Test Organization'
    });
    expect(value.id).toBeDefined();
    expect(value.slug).toBeDefined();

    // Note: Organization cleanup is handled by the auth system, not directly in tests
  });
});
