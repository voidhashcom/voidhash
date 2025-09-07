import { zValidator } from '@hono/zod-validator';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
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
        Effect.gen(function* () {
          const authService = yield* AuthService;
          const sdkService = yield* SdkService;
          const environmentService = yield* EnvironmentService;
          const authSession =
            yield* authService.authenticateWithPublishableKey();
          return yield* AuthSession.provide(authSession)(
            Effect.gen(function* () {
              const environment =
                yield* environmentService.getEnvironmentFromApiAuthSession();
              const customer = yield* Environment.provide(environment)(
                sdkService.syncCustomerAttributes({
                  name: c.req.valid('json').name,
                  email: c.req.valid('json').email
                })
              );

              return c.json({});
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
          );
        })
      )
  );
