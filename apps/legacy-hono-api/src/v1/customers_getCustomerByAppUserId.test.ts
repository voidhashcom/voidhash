import { CustomerOrigin, customers, type InsertCustomer } from '@voidhash/db';
import { generateId } from '@voidhash/lib';
import { Environment } from '@voidhash/lib/constants';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import type { z } from 'zod';
import { IntegrationHarness } from '@/lib/testing/integration-harness';
import type { customerResponseSchema } from './schema';

describe.sequential('/v1/customers/**', () => {
  test('GET /v1/customers/by-app-user-id/:appUserId - success', async (t) => {
    const h = await IntegrationHarness.init(t);
    const testAppUserId = `test-app-user-${generateId('test')}`;

    // Directly insert a customer for testing
    const customerInput: Omit<InsertCustomer, 'projectId'> = {
      id: generateId('test'),
      email: 'getbyappid@test.com',
      name: 'Get By App User ID Test',
      appUserId: testAppUserId,
      origin: CustomerOrigin.API,
      environment: Environment.Production
    };

    await h.db.primary.insert(customers).values({
      ...customerInput,
      projectId: h.resources.project.id
    });

    const res = await h.get({
      url: `/v1/customers/by-app-user-id/${testAppUserId}`,
      headers: {
        'x-secret-key': h.resources.secretKey.unhashedKey
      }
    });

    expect(
      res.status,
      `expected 200, received: ${JSON.stringify(res, null, 2)}`
    ).toBe(200);

    const responseBody = res.body as z.infer<typeof customerResponseSchema>;

    expect(responseBody.customerId).toBe(customerInput.id);
    expect(responseBody.email).toBe(customerInput.email);
    expect(responseBody.name).toBe(customerInput.name);
    expect(responseBody.appUserId).toBe(customerInput.appUserId);
    // expect(responseBody.origin).toBe(customerInput.origin);

    // Clean up the created customer
    t.onTestFinished(async () => {
      await h.db.primary
        .delete(customers)
        .where(eq(customers.id, customerInput.id));
    });
  });

  test('GET /v1/customers/by-app-user-id/:appUserId - not found', async (t) => {
    const h = await IntegrationHarness.init(t);
    const nonExistentAppUserId = `non-existent-${generateId('test')}`;

    const res = await h.get({
      url: `/v1/customers/by-app-user-id/${nonExistentAppUserId}`,
      headers: {
        'x-secret-key': h.resources.secretKey.unhashedKey
      }
    });

    expect(
      res.status,
      `expected 404, received: ${JSON.stringify(res, null, 2)}`
    ).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        docs: expect.any(String),
        message: 'Customer not found',
        requestId: expect.any(String)
      }
    });
  });
});
