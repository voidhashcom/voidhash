import { CustomerOrigin, customers, eq } from '@voidhash/db';
import { ANONYMOUS_USER_ID_PREFIX, generateId } from '@voidhash/lib';
import { Environment as EnvironmentEnum } from '@voidhash/lib/constants';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { createMockEnvironment } from '../../testing/__mocks__/environment.mock';
import { IntegrationHarness } from '../../testing/integration-harness';
import { AuthSession } from '../auth-service';
import { CustomerService } from '../customer-service';
import { Environment } from '../environment-service';
import { CustomerNotFoundError, InvalidAnonymousIdError } from '../errors';

describe.sequential('CustomerService error path', () => {
  test('should fail to create an anonymous customer with invalid app user ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      appUserId: `${ANONYMOUS_USER_ID_PREFIX}test-anonymous-user-id`,
      origin: CustomerOrigin.Dashboard,
      environment: EnvironmentEnum.Production
    };
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const customerService = yield* CustomerService;
            const customer = yield* customerService.createCustomer(input);
            return customer;
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
    expect(error).toBeInstanceOf(InvalidAnonymousIdError);

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(customers)
        .where(eq(customers.appUserId, input.appUserId));
    });
  });

  test('should fail to get customer by non-existent ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('customer');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const customerService = yield* CustomerService;
            const customer =
              yield* customerService.getCustomerById(nonExistentId);
            return customer;
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
    expect(error).toBeInstanceOf(CustomerNotFoundError);
  });

  test('should fail to get customer by non-existent app user ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentAppUserId = 'non-existent-app-user-id';
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const customerService = yield* CustomerService;
            const customer =
              yield* customerService.getCustomerByAppUserId(
                nonExistentAppUserId
              );
            return customer;
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
    expect(error).toBeInstanceOf(CustomerNotFoundError);
  });

  test('should fail to get customer unlocked perks for non-existent customer', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const nonExistentId = generateId('customer');
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const customerService = yield* CustomerService;
            const perks =
              yield* customerService.getCustomersUnlockedPerks(nonExistentId);
            return perks;
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
    expect(error).toBeInstanceOf(CustomerNotFoundError);
  });

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
    expect(error).toBeInstanceOf(CustomerNotFoundError);
  });

  // test("should fail to merge customers with invalid anonymous ID", async (t) => {
  // 	const h = await IntegrationHarness.init(t);

  // 	const integrationTestRunner = createIntegrationTestRunner("hono");
  // 	const result = await integrationTestRunner(
  // 		Effect.gen(function* () {
  // 			return yield* pipe(
  // 				Effect.gen(function* () {
  // 					const customerService = yield* CustomerService;
  // 					const customer = yield* customerService.mergeCustomers(
  // 						generateId("test"),
  // 						generateId("test"),
  // 					);
  // 					return customer;
  // 				}),
  // 			);
  // 		}),
  // 	);

  // 	expect(Exit.isFailure(result)).toBe(true);
  // 	const error = Exit.getOrElse(result, (e) => Cause.squash(e));
  // 	expect(error).toBeInstanceOf(InvalidAnonymousIdError);
  // });
});
