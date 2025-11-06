import {
  CustomerOrigin,
  customers,
  eq,
  type InsertCustomer
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { ANONYMOUS_USER_ID_PREFIX, generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { CustomerService } from '../index';

describe.sequential('mergeCustomers happy path', () => {
  test('should merge customers successfully', async (t) => {
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

            // Create two test customers
            const fromCustomer = {
              id: generateId('customer'),
              projectId: h.resources.project.id,
              appUserId: `${ANONYMOUS_USER_ID_PREFIX}from-customer`,
              name: 'From Customer',
              email: 'from@example.com',
              origin: CustomerOrigin.Dashboard,
              type: 1, // Identified
              parentCustomerId: null,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const toCustomer = {
              id: generateId('customer'),
              projectId: h.resources.project.id,
              appUserId: 'to-customer',
              name: 'To Customer',
              email: 'to@example.com',
              origin: CustomerOrigin.Dashboard,
              type: 1, // Identified
              parentCustomerId: null,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            yield* _createCustomerRecord(fromCustomer);
            yield* _createCustomerRecord(toCustomer);

            const result = yield* customerService.mergeCustomers(
              fromCustomer.id,
              toCustomer.id
            );
            return result;
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
      id: expect.any(String)
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(customers)
        .where(eq(customers.appUserId, 'from-customer'));
      await h.db.primary
        .delete(customers)
        .where(eq(customers.appUserId, 'to-customer'));
    });
  });
});

