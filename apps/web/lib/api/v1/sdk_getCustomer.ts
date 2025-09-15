import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import { authenticateWithPublishableKey } from '@/lib/services/auth.service';
import { withEnvironmentFromApiKey } from '@/lib/services/environment.service';
import { SdkService } from '@/lib/services/sdk.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import {
  type customerResponseSchema,
  sdkCustomerResponseSchema
} from './schema';

const route = describeRoute({
  description: 'Get a customer by app user ID',
  operationId: 'sdkGetCustomerByAppUserId',
  security: [
    {
      publishableKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': { schema: resolver(sdkCustomerResponseSchema) }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['SDK']
});

export type Route = typeof route;

export const registerSdkGetCustomer = (app: App) =>
  app.get('/v1/sdk/get-customer', route, async (c) =>
    createEffectHandler(c)(
      authenticateWithPublishableKey(
        withEnvironmentFromApiKey()(
          Effect.gen(function* () {
            const sdkService = yield* SdkService;
            const customer = yield* sdkService.getCustomer();

            if (!customer) {
              return yield* Effect.fail(
                new HonoErrorResponse({
                  code: 'NOT_FOUND',
                  message: 'Customer not found'
                })
              );
            }

            return c.json<z.infer<typeof customerResponseSchema>>({
              customerId: customer.id,
              name: customer.name ?? null,
              email: customer.email,
              appUserId: customer.appUserId ?? null
              // origin: customer.origin,
            });
          })
        )
      )
    )
  );
