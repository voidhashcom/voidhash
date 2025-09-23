import { eq, paywalls } from '@voidhash/db';
import { generateId } from '@voidhash/lib';
import { Environment as EnvironmentEnum } from '@voidhash/lib/constants';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { createMockEnvironment } from '../../testing/__mocks__/environment.mock';
import { IntegrationHarness } from '../../testing/integration-harness';
import { AuthSession } from '../auth-service';
import { Environment } from '../environment-service';
import { PaywallService } from '../paywall-service';

describe.sequential('PaywallService happy path', () => {
  test('should create a paywall successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      name: 'Test Paywall'
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            const paywall = yield* paywallService.createPaywall(input);
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

  test('should get paywalls for a project', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;

            // Create a test paywall
            const testPaywall = {
              id: generateId('paywall'),
              projectId: h.resources.project.id,
              name: 'Test Paywall for List',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* paywallService.createPaywall({
              projectId: testPaywall.projectId,
              name: testPaywall.name
            });

            const paywalls = yield* paywallService.getPaywalls(
              h.resources.project.id
            );
            return paywalls;
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

    expect(value.length).toBeGreaterThan(0);
    const testPaywall = value.find((p) => p.name === 'Test Paywall for List');
    expect(testPaywall).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Paywall for List'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywalls)
        .where(eq(paywalls.name, 'Test Paywall for List'));
    });
  });

  test('should get paywall by ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;

            // Create a test paywall
            const testPaywall = {
              id: generateId('paywall'),
              projectId: h.resources.project.id,
              name: 'Test Paywall By ID',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const createdPaywall = yield* paywallService.createPaywall({
              projectId: testPaywall.projectId,
              name: testPaywall.name
            });

            const paywall = yield* paywallService.getPaywallById(
              createdPaywall.id
            );
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      projectId: h.resources.project.id,
      name: 'Test Paywall By ID'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywalls)
        .where(eq(paywalls.name, 'Test Paywall By ID'));
    });
  });

  test('should update paywall successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;

            // Create a test paywall
            const testPaywall = {
              id: generateId('paywall'),
              projectId: h.resources.project.id,
              name: 'Test Paywall for Update',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const createdPaywall = yield* paywallService.createPaywall({
              projectId: testPaywall.projectId,
              name: testPaywall.name
            });

            const input = {
              paywallId: createdPaywall.id,
              name: 'Updated Paywall Name',
              paywallProducts: []
            };
            yield* paywallService.updatePaywall(input);
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toBe('updated');

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(paywalls)
        .where(eq(paywalls.name, 'Updated Paywall Name'));
    });
  });

  test('should delete paywall successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;

            // Create a test paywall
            const testPaywall = {
              id: generateId('paywall'),
              projectId: h.resources.project.id,
              name: 'Test Paywall for Delete',
              environment: EnvironmentEnum.Production,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const createdPaywall = yield* paywallService.createPaywall({
              projectId: testPaywall.projectId,
              name: testPaywall.name
            });

            yield* paywallService.deletePaywall({
              paywallId: createdPaywall.id
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
  });
});
