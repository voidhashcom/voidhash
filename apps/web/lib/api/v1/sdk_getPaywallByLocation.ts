import { zValidator } from '@hono/zod-validator';
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
  sdkGetPaywallByLocationParamsSchema,
  sdkGetPaywallByLocationQuerySchema,
  sdkPaywallResponseSchema
} from './schema';

const route = describeRoute({
  description: 'Get paywall by location',
  operationId: 'sdkGetPaywallByLocation',
  security: [
    {
      publishableKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': { schema: resolver(sdkPaywallResponseSchema) }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['SDK']
});

export type Route = typeof route;

export const registerSdkGetPaywallByLocation = (app: App) =>
  app.get(
    '/v1/sdk/get-paywall-by-location/:locationSlug',
    route,
    zValidator('param', sdkGetPaywallByLocationParamsSchema),
    zValidator('query', sdkGetPaywallByLocationQuerySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithPublishableKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const sdkService = yield* SdkService;
              const paywall = yield* sdkService.getPaywallByLocation({
                locationSlug: c.req.param('locationSlug'),
                nativePaymentProviderId: c.req.query('nativePaymentProviderId')
              });
              return c.json<z.infer<typeof sdkPaywallResponseSchema>>(paywall);
            }).pipe(
              Effect.catchTags({
                PaywallNotFound: (error) =>
                  Effect.fail(
                    new HonoErrorResponse({
                      code: 'NOT_FOUND',
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
