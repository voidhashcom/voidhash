import {
  CustomerOrigin,
  customers,
  eq,
  or,
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

describe.sequential('getCustomerByAppUserId happy path', () => {
  test('should get customer by app user ID', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const testCustomerId = generateId('test');
    const testCustomerDifferentProjectId = generateId('test');

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
              id: testCustomerId,
              projectId: h.resources.project.id,
              appUserId: 'test-customer-by-app-user-id',
              name: 'Test Customer By App User ID',
              email: 'test-by-app-user-id@example.com',
              origin: CustomerOrigin.Dashboard,
              type: 1, // Identified
              parentCustomerId: null,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Create a test customer for different project
            const testCustomerDifferentProject = {
              id: testCustomerDifferentProjectId,
              projectId: generateId('test'),
              appUserId: 'test-customer-by-app-user-id',
              name: 'Test Customer',
              email: 'test@example.com',
              origin: CustomerOrigin.Dashboard,
              type: 1, // Identified
              parentCustomerId: null,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            yield* _createCustomerRecord(testCustomerDifferentProject);
            yield* _createCustomerRecord(testCustomer);

            const customer = yield* customerService.getCustomerByAppUserId(
              'test-customer-by-app-user-id',
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

    expect(Exit.isSuccess(result)).toBe(true);
    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(value).toMatchObject({
      id: testCustomerId,
      appUserId: 'test-customer-by-app-user-id',
      name: 'Test Customer By App User ID',
      email: 'test-by-app-user-id@example.com'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(customers)
        .where(
          or(
            eq(customers.id, testCustomerId),
            eq(customers.id, testCustomerDifferentProjectId)
          )
        );
    });
  });
});
