import { CustomerOrigin, CustomerType, customers, eq } from '@voidhash/db';
import { ANONYMOUS_USER_ID_PREFIX, generateId } from '@voidhash/lib';
import { AuthSession, CustomerNotFoundError } from '@voidhash/shared';
import { Cause, Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { IntegrationHarness } from '../../testing/integration-harness';
import { CustomerService } from '../customers';

describe.sequential('CustomerService error path', () => {
  test('should create an anonymous customer successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      appUserId: `${ANONYMOUS_USER_ID_PREFIX}test-anonymous-user-id`,
      name: null,
      email: null,
      origin: CustomerOrigin.Dashboard
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
      appUserId: `${ANONYMOUS_USER_ID_PREFIX}test-anonymous-user-id`,
      type: CustomerType.Anonymous,
      origin: CustomerOrigin.Dashboard
    });

    t.onTestFinished(async () => {
      if (value?.id) {
        await h.db.primary.delete(customers).where(eq(customers.id, value.id));
      }
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
            const customer = yield* customerService.getCustomerByAppUserId(
              nonExistentAppUserId,
              h.resources.project.id
            );
            return customer;
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
