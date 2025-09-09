import { eq, paywallLocations } from '@voidhash/db';
import { generateId } from '@voidhash/lib';
import { Environment as EnvironmentEnum } from '@voidhash/lib/constants';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { PaywallLocationRepository } from '../../repositories/paywall-location-repository';
import { PaywallRepository } from '../../repositories/paywall-repository';
import { createMockEnvironment } from '../../testing/__mocks__/environment.mock';
import { IntegrationHarness } from '../../testing/integration-harness';
import { AuthSession } from '../auth-service';
import { Environment } from '../environment-service';
import { PaywallLocationService } from '../paywall-location-service';

describe.sequential('PaywallLocationService happy path', () => {
  test('should create a paywall location successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
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
              name: 'Test Paywall',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallRepository.createPaywall(testPaywall);

            const input = {
              projectId: h.resources.project.id,
              name: 'Test Paywall Location',
              slug: 'test-paywall-location',
              defaultPaywallId: testPaywall.id
            };
            const paywallLocation =
              yield* paywallLocationService.createPaywallLocation(input);
            return { paywallLocation, testPaywall };
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });
    expect(value.paywallLocation).toMatchObject({
      id: expect.any(String)
    });

    t.onTestFinished(async () => {
      if (value?.paywallLocation?.id) {
        await h.db.primary
          .delete(paywallLocations)
          .where(eq(paywallLocations.id, value.paywallLocation.id));
      }
      if (value?.testPaywall?.id) {
        // Note: Paywall cleanup would need to be handled separately
      }
    });
  });

  test('should get paywall locations for a project', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const testLocationId = generateId('test');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;
            const paywallRepository = yield* PaywallRepository;
            const paywallLocationRepository = yield* PaywallLocationRepository;

            // Create a test paywall first
            const testPaywall = {
              id: generateId('test'),
              projectId: h.resources.project.id,
              name: 'Test Paywall for Locations',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallRepository.createPaywall(testPaywall);

            // Create a test paywall location
            const testPaywallLocation = {
              id: testLocationId,
              projectId: h.resources.project.id,
              name: 'Test Paywall Location for List',
              slug: 'test-paywall-location-for-list',
              environment: EnvironmentEnum.Production,
              defaultPaywallId: testPaywall.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const testPaywallLocationDifferentProject = {
              id: generateId('test'),
              projectId: generateId('test'),
              name: 'Test Paywall Location for List',
              slug: 'test-paywall-location-for-list',
              environment: EnvironmentEnum.Production,
              defaultPaywallId: testPaywall.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const testPaywallLocationDifferentEnvironment = {
              id: generateId('test'),
              projectId: h.resources.project.id,
              name: 'Test Paywall Location for List',
              slug: 'test-paywall-location-for-list',
              environment: EnvironmentEnum.Testing,
              defaultPaywallId: testPaywall.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            yield* paywallLocationRepository.createPaywallLocation(
              testPaywallLocationDifferentProject
            );
            yield* paywallLocationRepository.createPaywallLocation(
              testPaywallLocationDifferentEnvironment
            );

            yield* paywallLocationRepository.createPaywallLocation(
              testPaywallLocation
            );

            const paywallLocations =
              yield* paywallLocationService.getPaywallLocations(
                h.resources.project.id
              );

            return { paywallLocations };
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value.paywallLocations.length).toBe(1);
    const testLocation = value.paywallLocations.find(
      (loc) => loc.slug === 'test-paywall-location-for-list'
    );
    expect(testLocation).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Paywall Location for List',
      slug: 'test-paywall-location-for-list'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallLocations)
        .where(eq(paywallLocations.slug, 'test-paywall-location-for-list'));
    });
  });

  test('should get paywall location by ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;
            const paywallRepository = yield* PaywallRepository;
            const paywallLocationRepository = yield* PaywallLocationRepository;

            // Create a test paywall first
            const testPaywall = {
              id: generateId('paywall'),
              projectId: h.resources.project.id,
              name: 'Test Paywall for By ID',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallRepository.createPaywall(testPaywall);

            // Create a test paywall location
            const testPaywallLocation = {
              id: generateId('paywallLocation'),
              projectId: h.resources.project.id,
              name: 'Test Paywall Location By ID',
              slug: 'test-paywall-location-by-id',
              environment: EnvironmentEnum.Production,
              defaultPaywallId: testPaywall.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallLocationRepository.createPaywallLocation(
              testPaywallLocation
            );

            const paywallLocation =
              yield* paywallLocationService.getPaywallLocationById(
                testPaywallLocation.id
              );
            return { paywallLocation };
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value.paywallLocation).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Paywall Location By ID',
      slug: 'test-paywall-location-by-id'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallLocations)
        .where(eq(paywallLocations.slug, 'test-paywall-location-by-id'));
    });
  });

  test('should delete paywall location successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallLocationService = yield* PaywallLocationService;
            const paywallRepository = yield* PaywallRepository;
            const paywallLocationRepository = yield* PaywallLocationRepository;

            // Create a test paywall first
            const testPaywall = {
              id: generateId('test'),
              projectId: h.resources.project.id,
              name: 'Test Paywall for Delete',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallRepository.createPaywall(testPaywall);

            // Create a test paywall location
            const testPaywallLocation = {
              id: generateId('test'),
              projectId: h.resources.project.id,
              name: 'Test Paywall Location for Delete',
              slug: 'test-paywall-location-for-delete',
              environment: EnvironmentEnum.Production,
              defaultPaywallId: testPaywall.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallLocationRepository.createPaywallLocation(
              testPaywallLocation
            );

            yield* paywallLocationService.deletePaywallLocation({
              paywallLocationId: testPaywallLocation.id
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toBe('deleted');

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywallLocations)
        .where(eq(paywallLocations.slug, 'test-paywall-location-for-delete'));
    });
  });
});
