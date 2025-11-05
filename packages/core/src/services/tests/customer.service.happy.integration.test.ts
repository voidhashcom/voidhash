import {
  CustomerOrigin,
  CustomerType,
  customers,
  eq,
  type InsertCustomer,
  or
} from '@voidhash/db';
import { Db, TransactionContext } from '@voidhash/db/effect';
import { ANONYMOUS_USER_ID_PREFIX, generateId } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../integration-test-runtime';
import { IntegrationHarness } from '../../testing/integration-harness';
import { CustomerService } from '../customer-service';

describe.sequential('CustomerService happy path', () => {
  test('should create a customer successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      appUserId: 'test-app-user-id',
      name: 'Test Customer',
      email: 'test@example.com',
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
      appUserId: 'test-app-user-id',
      name: 'Test Customer',
      email: 'test@example.com',
      type: CustomerType.Identified,
      origin: CustomerOrigin.Dashboard
    });

    t.onTestFinished(async () => {
      if (value?.id) {
        await h.db.primary.delete(customers).where(eq(customers.id, value.id));
      }
    });
  });

  test('should create an anonymous customer successfully', async (t) => {
    const h = await IntegrationHarness.init(t);

    const integrationTestRunner = createIntegrationTestRunner();
    const input = {
      projectId: h.resources.project.id,
      appUserId: `${ANONYMOUS_USER_ID_PREFIX}test-anonymous-user-id`,
      origin: CustomerOrigin.Dashboard,
      name: null,
      email: null
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
      origin: CustomerOrigin.Dashboard,
      type: CustomerType.Anonymous
    });

    t.onTestFinished(async () => {
      if (value?.id) {
        await h.db.primary.delete(customers).where(eq(customers.id, value.id));
      }
    });
  });

  test('should get customers for a project', async (t) => {
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
              appUserId: 'test-customer-user-id',
              name: 'Test Customer',
              email: 'test@example.com',
              origin: CustomerOrigin.Dashboard,
              type: 1, // Identified
              parentCustomerId: null,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Create a test customer for different project
            const testCustomerDifferentProject = {
              id: generateId('test'),
              projectId: generateId('test'),
              appUserId: 'test-customer-user-id',
              name: 'Test Customer',
              email: 'test@example.com',
              origin: CustomerOrigin.Dashboard,
              type: 1, // Identified
              parentCustomerId: null,
              archivedAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const customersList = yield* dbService.transaction((tx) =>
              TransactionContext.provide(tx)(
                Effect.gen(function* () {
                  yield* _createCustomerRecord(testCustomer);
                  yield* _createCustomerRecord(testCustomerDifferentProject);

                  const customersList = yield* customerService.getCustomers({
                    projectId: h.resources.project.id
                  });

                  return customersList;
                })
              )
            );

            return customersList;
          }),
          Effect.provideService(
            AuthSession,
            h.createAuthSession({ type: 'user' })
          )
        );
      })
    );

    const value = Exit.getOrElse(result, (e) => {
      throw e;
    });

    expect(Exit.isSuccess(result)).toBe(true);

    expect(value.length).toBeGreaterThan(0);
    const testCustomer = value.find(
      (c) => c.appUserId === 'test-customer-user-id'
    );
    expect(testCustomer).toMatchObject({
      projectId: h.resources.project.id,
      appUserId: 'test-customer-user-id',
      name: 'Test Customer',
      email: 'test@example.com'
    });

    t.onTestFinished(async () => {
      await h.db.primary
        .delete(customers)
        .where(eq(customers.appUserId, 'test-customer-user-id'));
    });
  });

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
