import { eq, type InsertPaywall, paywalls } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { PaywallService } from '../index';

describe.sequential('getPaywalls happy path', () => {
  test('should get paywalls for a project', async (t) => {
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

            // Create a test paywall
            const testPaywallId = generateId('paywall');
            yield* _createPaywallRecord({
              id: testPaywallId,
              projectId: h.resources.project.id,
              name: 'Test Paywall',
              slug: 'test-paywall',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Create a test paywall for different project
            const testPaywallDifferentProjectId = generateId('paywall');
            yield* _createPaywallRecord({
              id: testPaywallDifferentProjectId,
              projectId: generateId('test'),
              name: 'Test Paywall Different Project',
              slug: 'test-paywall-different-project',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            const paywallsList = yield* paywallService.getPaywalls(
              h.resources.project.id
            );

            return {
              paywallsList,
              testPaywallId,
              testPaywallDifferentProjectId
            };
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

    expect(value.paywallsList.length).toBeGreaterThan(0);
    const testPaywall = value.paywallsList.find(
      (p) => p.id === value.testPaywallId
    );
    expect(testPaywall).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Paywall',
      slug: 'test-paywall'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywalls)
        .where(eq(paywalls.id, value.testPaywallId));
      await h.db.primary
        .delete(paywalls)
        .where(eq(paywalls.id, value.testPaywallDifferentProjectId));
    });
  });
});
