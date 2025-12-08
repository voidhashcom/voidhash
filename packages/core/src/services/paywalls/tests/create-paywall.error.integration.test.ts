import { eq, paywalls } from '@voidhash/db';
import { AuthSession, PaywallSlugAlreadyExistsError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PaywallService } from '../index';

describe.sequential('createPaywall error path', () => {
  test('should fail to create paywall with duplicate slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const slug = 'duplicate-slug-paywall';
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;

            // Create first paywall
            yield* paywallService.createPaywall({
              projectId: h.resources.project.id,
              name: 'First Paywall',
              slug
            });

            // Try to create second paywall with same slug
            const secondPaywall = yield* paywallService.createPaywall({
              projectId: h.resources.project.id,
              name: 'Second Paywall',
              slug
            });
            return secondPaywall;
          }),
          Effect.provide(PaywallService.Default),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PaywallSlugAlreadyExistsError);

    t.onTestFinished(async () => {
      await h.db.primary.delete(paywalls).where(eq(paywalls.slug, slug));
    });
  });
});
