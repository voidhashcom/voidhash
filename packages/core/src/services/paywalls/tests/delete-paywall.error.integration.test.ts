import { generateId } from '@voidhash/lib';
import { AuthSession, PaywallNotFoundError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PaywallService } from '../index';

describe.sequential('deletePaywall error path', () => {
  test('should fail to delete non-existent paywall', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('paywall');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            yield* paywallService.deletePaywall({
              paywallId: nonExistentId
            });
            return 'deleted';
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
    expect(error).toBeInstanceOf(PaywallNotFoundError);
  });
});
