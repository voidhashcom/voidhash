import { generateId } from '@voidhash/lib';
import { AuthSession, CustomerNotFoundError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { CustomerService } from '../index';

describe.sequential('getCustomerPurchases error path', () => {
  test('should fail to get customer purchases for non-existent customer', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('customer');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const customerService = yield* CustomerService;
            const purchases =
              yield* customerService.getCustomerPurchases(nonExistentId);
            return purchases;
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(CustomerNotFoundError);
  });
});

