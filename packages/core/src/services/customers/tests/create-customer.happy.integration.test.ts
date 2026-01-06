import {
  CustomerOrigin,
  CustomerType,
  customers,
  eq,
  type InsertCustomer
} from '@voidhash/db';
import { ANONYMOUS_USER_ID_PREFIX } from '@voidhash/lib';
import { AuthSession } from '@voidhash/shared';
import { Effect, Exit, pipe } from 'effect';
import { describe, expect, test } from 'vitest';
import { createIntegrationTestRunner } from '../../../integration-test-runtime';
import { IntegrationHarness } from '../../../testing/integration-harness';
import { CustomerService } from '../index';

describe.sequential('createCustomer happy path', () => {
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
});
