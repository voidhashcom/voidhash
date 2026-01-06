import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { OrganizationService } from '../index';

describe.sequential('getOrganizationBySlug happy path', () => {
  test('should get organization by slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const organizationService = yield* OrganizationService;
            const organization =
              yield* organizationService.getOrganizationBySlug(
                // biome-ignore lint/style/noNonNullAssertion: allways true, ok in test
                h.resources.organization.slug!
              );
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      id: h.resources.organization.id,
      name: h.resources.organization.name,
      slug: h.resources.organization.slug
    });
  });
});
