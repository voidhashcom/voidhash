import { zValidator } from '@hono/zod-validator';
import {
  authenticateWithPublishableKey,
  SdkService,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import {
  type customerResponseSchema,
  sdkCustomerResponseSchema,
  sdkIdentifyCustomerBodySchema
} from './schema';

const route = describeRoute({
  description:
    'Identifies a customer. If the customer does not exist, it will be created.',
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

export const registerSdkIdentify = (app: App) =>
  app.post(
    '/v1/sdk/identify',
    route,
    zValidator('json', sdkIdentifyCustomerBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithPublishableKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const sdkService = yield* SdkService;
              const customer = yield* sdkService.identifyCustomer({
                appUserId: c.req.valid('json').appUserId,
                name: c.req.valid('json').name ?? null,
                email: c.req.valid('json').email ?? null
              });
              return c.json<z.infer<typeof customerResponseSchema>>({
                customerId: customer.id,
                name: customer.name ?? null,
                email: customer.email,
                appUserId: customer.appUserId ?? null
                // origin: customer.origin,
              });
            }).pipe(
              Effect.catchTags({
                CustomerConflict: (error) =>
                  Effect.fail(
                    new HonoErrorResponse({
                      code: 'CONFLICT',
                      message: error.message,
                      originalError: error
                    })
                  ),
                CustomerCreation: (error) =>
                  Effect.fail(
                    new HonoErrorResponse({
                      code: 'INTERNAL_SERVER_ERROR',
                      message: error.message,
                      originalError: error
                    })
                  )
              })
            )
          )
        )
      )
  );
