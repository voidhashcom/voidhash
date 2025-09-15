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
  sdkCheckoutResponseSchema,
  sdkCreateCheckoutBodySchema
} from './schema';

const route = describeRoute({
  description: 'Creates a new checkout session',
  operationId: 'sdkCreateCheckout',
  security: [
    {
      publishableKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': { schema: resolver(sdkCheckoutResponseSchema) }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['SDK']
});

export type Route = typeof route;

export const registerSdkCreateCheckout = (app: App) =>
  app.post(
    '/v1/sdk/create-checkout',
    route,
    zValidator('json', sdkCreateCheckoutBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithPublishableKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const sdkService = yield* SdkService;
              const checkout = yield* sdkService.createCheckout({
                paymentProviderConfigurationProductId:
                  c.req.valid('json').paymentProviderConfigurationProductId,
                successCallbackUrl: c.req.valid('json').successCallbackUrl,
                errorCallbackUrl: c.req.valid('json').errorCallbackUrl
              });
              return c.json<z.infer<typeof sdkCheckoutResponseSchema>>({
                checkoutSessionId: checkout.checkoutSessionId,
                checkoutUrl: checkout.checkoutUrl
              });
            }).pipe(
              Effect.catchTags({
                ProductNotFound: (error) =>
                  Effect.fail(
                    new HonoErrorResponse({
                      code: 'NOT_FOUND',
                      message: error.message,
                      originalError: error
                    })
                  ),
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
