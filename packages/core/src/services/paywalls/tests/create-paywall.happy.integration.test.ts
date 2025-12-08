import { eq, paywalls } from '@voidhash/db';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PaywallService } from '../index';

describe.sequential('createPaywall happy path', () => {
  test('should create a paywall successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      name: 'Test Paywall',
      slug: 'test-paywall'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            const paywall = yield* paywallService.createPaywall(input);
            return paywall;
          }),
          Effect.provide(PaywallService.Default),
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
      id: expect.any(String)
    });

    t.onTestFinished(async () => {
      if (value?.id) {
        await h.db.primary.delete(paywalls).where(eq(paywalls.id, value.id));
      }
    });
  });
});
