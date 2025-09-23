import { paywalls } from '@voidhash/db';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import type { z } from 'zod';
import { IntegrationHarness } from '@/lib/testing/integration-harness';
import type { createPaywallBodySchema, paywallResponseSchema } from './schema';

describe.sequential('/v1/paywalls', () => {
  test('POST /v1/paywalls - create paywall', async (t) => {
    const h = await IntegrationHarness.init(t);

    const paywallInput: z.infer<typeof createPaywallBodySchema> = {
      name: 'Test Paywall'
    };

    const res = await h.post({
      url: '/v1/paywalls',
      headers: {
        'Content-Type': 'application/json',
        'x-secret-key': h.resources.secretKey.unhashedKey
      },
      body: paywallInput
    });

    expect(
      res.status,
      `expected 200, received: ${JSON.stringify(res, null, 2)}`
    ).toBe(200);

    const responseBody = res.body as z.infer<typeof paywallResponseSchema>;

    expect(responseBody.paywallId).toBeDefined();
    expect(responseBody.name).toBe(paywallInput.name);

    // Clean up the created paywall
    t.onTestFinished(async () => {
      if (responseBody?.paywallId) {
        await h.db.primary
          .delete(paywalls)
          .where(eq(paywalls.id, responseBody.paywallId));
      }
    });
  });
});
