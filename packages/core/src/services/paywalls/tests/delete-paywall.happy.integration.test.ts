import { type InsertPaywall, paywalls } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PaywallService } from '../index';

describe.sequential('deletePaywall happy path', () => {
  test('should delete paywall successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            const dbService = yield* Db;

            const _createPaywallRecord = dbService.makeQuery(
              (execute, paywall: InsertPaywall) =>
                execute(async (db) => {
                  await db.insert(paywalls).values(paywall);
                  return { id: paywall.id };
                })
            );

            // Create a test paywall to delete
            const testPaywallId = generateId('paywall');
            yield* _createPaywallRecord({
              id: testPaywallId,
              projectId: h.resources.project.id,
              name: 'Paywall To Delete',
              slug: 'paywall-to-delete',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            yield* paywallService.deletePaywall({
              paywallId: testPaywallId
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toBe('deleted');
  });
});
