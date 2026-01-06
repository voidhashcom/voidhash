import {
  CustomerOrigin,
  customers,
  eq,
  type InsertCustomer
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { CustomerService } from '../index';

describe.sequential('getCustomerById happy path', () => {
  test('should get customer by ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const result = await integrationTestRunner(
      Effect.gen(function* () {
        return yield* pipe(
          Effect.gen(function* () {
            const customerService = yield* CustomerService;
            const dbService = yield* Db;
            const _createCustomerRecord = dbService.makeQuery(
              (execute, customer: InsertCustomer) =>
                execute(async (db) => {
                  await db.insert(customers).values(customer);
                  return { id: customer.id };
                })
            );

            // Create a test customer
            const testCustomer = {
              id: generateId('test'),
              projectId: h.resources.project.id,
              appUserId: 'test-customer-by-id',
              name: 'Test Customer By ID',
              email: 'test-by-id@example.com',
              origin: CustomerOrigin.Dashboard,
              type: 1, // Identified
              parentCustomerId: null,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* _createCustomerRecord(testCustomer);

            const customer = yield* customerService.getCustomerById(
              testCustomer.id
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      appUserId: 'test-customer-by-id',
      name: 'Test Customer By ID',
      email: 'test-by-id@example.com',
      projectId: h.resources.project.id
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(customers)
        .where(eq(customers.appUserId, 'test-customer-by-id'));
    });
  });
});
