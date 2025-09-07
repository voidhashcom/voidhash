import { eq, paywallLocations, paywalls } from '@voidhash/db';
import { Environment as EnvironmentEnum } from '@voidhash/lib/constants';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { generateId } from '@/lib/id/generate';
import { createIntegrationTestRunner } from '../../effect/runtimes/integration-test';
import { createMockEnvironment } from '../../testing/__mocks__/environment.mock';
import { IntegrationHarness } from '../../testing/integration-harness';
import { AuthSession } from '../auth.service';
import { Environment } from '../environment.service';
import {
  PaywallInUseError,
  PaywallNotFoundError,
  PaywallService
} from '../paywall.service';
import { PaywallLocationService } from '../paywall-location.service';

describe.sequential('PaywallService error path', () => {
  test('should fail to get paywall by non-existent ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentId = generateId('paywall');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            const paywall = yield* paywallService.getPaywallById(nonExistentId);
            return paywall;
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          ),
          Effect.provideService(
            Environment,
            createMockEnvironment(EnvironmentEnum.Production)
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PaywallNotFoundError);
  });

  test('should fail to update non-existent paywall', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentId = generateId('paywall');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            yield* paywallService.updatePaywall({
              paywallId: nonExistentId,
              name: 'Updated Name',
              paywallProducts: []
            });
            return 'updated';
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          ),
          Effect.provideService(
            Environment,
            createMockEnvironment(EnvironmentEnum.Production)
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PaywallNotFoundError);
  });

  test('should fail to delete non-existent paywall', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
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
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          ),
          Effect.provideService(
            Environment,
            createMockEnvironment(EnvironmentEnum.Production)
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PaywallNotFoundError);
  });

  test('should fail to delete paywall that is in use', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            const paywallLocationService = yield* PaywallLocationService;

            // Create a paywall
            const paywall = yield* paywallService.createPaywall({
              projectId: h.resources.project.id,
              name: 'Test Paywall for Delete'
            });

            // Create a paywall location that uses this paywall
            yield* paywallLocationService.createPaywallLocation({
              projectId: h.resources.project.id,
              name: 'Test Location',
              slug: 'test-location',
              defaultPaywallId: paywall.id
            });

            // Try to delete the paywall (should fail because it's in use)
            yield* paywallService.deletePaywall({
              paywallId: paywall.id
            });
            return 'deleted';
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          ),
          Effect.provideService(
            Environment,
            createMockEnvironment(EnvironmentEnum.Production)
          )
        );
      })
    );

    expect(Exit.isFailure(result)).toBe(true);
    const error = Exit.getOrElse(result, (e) => Cause.squash(e));
    expect(error).toBeInstanceOf(PaywallInUseError);

    // Clean up the created resources
    t.onTestFinished(async () => {
      // Clean up paywall location first
      await h.db.primary
        .delete(paywallLocations)
        .where(eq(paywallLocations.slug, 'test-location'));
      // Then clean up paywall
      await h.db.primary
        .delete(paywalls)
        .where(eq(paywalls.name, 'Test Paywall for Delete'));
    });
  });
});
