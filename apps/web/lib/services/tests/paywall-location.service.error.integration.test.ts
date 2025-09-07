import { Environment as EnvironmentEnum } from '@voidhash/lib/constants';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { generateId } from '@/lib/id/generate';
import { PaywallRepository } from '@/lib/repositories/paywall.repository';
import { createIntegrationTestRunner } from '../../effect/runtimes/integration-test';
import { createMockEnvironment } from '../../testing/__mocks__/environment.mock';
import { IntegrationHarness } from '../../testing/integration-harness';
import { AuthSession } from '../auth.service';
import { Environment } from '../environment.service';
import {
  DefaultPaywallNotFoundError,
  PaywallLocationNotFound,
  PaywallLocationService,
  SlugAlreadyExistsError
} from '../paywall-location.service';

describe.sequential('PaywallLocationService error path', () => {
  test('should fail to create paywall location with duplicate slug', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;
            const paywallRepository = yield* PaywallRepository;

            // Create a test paywall first
            const testPaywall = {
              id: generateId('paywall'),
              projectId: h.resources.project.id,
              name: 'Test Paywall for Duplicate',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallRepository.createPaywall(testPaywall);

            const input = {
              projectId: h.resources.project.id,
              name: 'Test Paywall Location',
              slug: 'duplicate-slug',
              defaultPaywallId: testPaywall.id
            };

            // Create first paywall location
            yield* paywallLocationService.createPaywallLocation(input);

            // Try to create second paywall location with same slug
            const duplicateInput = {
              projectId: h.resources.project.id,
              name: 'Duplicate Paywall Location',
              slug: 'duplicate-slug',
              defaultPaywallId: testPaywall.id
            };
            yield* paywallLocationService.createPaywallLocation(duplicateInput);
            return 'created';
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
    expect(error).toBeInstanceOf(SlugAlreadyExistsError);
  });

  test('should fail to create paywall location with non-existent paywall', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentPaywallId = generateId('paywall');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;

            const input = {
              projectId: h.resources.project.id,
              name: 'Test Paywall Location',
              slug: 'test-paywall-location-non-existent-paywall',
              defaultPaywallId: nonExistentPaywallId
            };
            yield* paywallLocationService.createPaywallLocation(input);
            return 'created';
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
    expect(error).toBeInstanceOf(DefaultPaywallNotFoundError);
  });

  test('should fail to get paywall location by non-existent ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentId = generateId('paywallLocation');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;
            const paywallLocation =
              yield* paywallLocationService.getPaywallLocationById(
                nonExistentId
              );
            return paywallLocation;
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
    expect(error).toBeInstanceOf(PaywallLocationNotFound);
  });

  test('should fail to delete non-existent paywall location', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner('hono');
    const nonExistentId = generateId('paywallLocation');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;
            yield* paywallLocationService.deletePaywallLocation({
              paywallLocationId: nonExistentId
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
    expect(error).toBeInstanceOf(PaywallLocationNotFound);
  });
});
