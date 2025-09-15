import { zValidator } from '@hono/zod-validator';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
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
  sdkCustomerResponseSchema,
  sdkSyncCustomerAttributesBodySchema
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

export const registerSdkSyncCustomerAttributes = (app: App) =>
  app.post(
    '/v1/sdk/sync-customer-attributes',
    route,
    zValidator('json', sdkSyncCustomerAttributesBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithPublishableKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const sdkService = yield* SdkService;
              const customer = yield* sdkService.syncCustomerAttributes({
                name: c.req.valid('json').name,
                email: c.req.valid('json').email
              });

              return c.json(customer);
            }).pipe(
              Effect.catchTags({
                InvalidAnonymousIdError: (error) =>
                  Effect.fail(
                    new HonoErrorResponse({
                      code: 'BAD_REQUEST',
                      message: error.message
                    })
                  )
              })
            )
          )
        )
      )
  );
