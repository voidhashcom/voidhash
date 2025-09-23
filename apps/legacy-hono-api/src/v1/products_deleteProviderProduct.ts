import { zValidator } from '@hono/zod-validator';
import {
  authenticateWithSecretKey,
  ProductService,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import { z } from 'zod';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { deleteProviderProductParamsSchema } from './schema';

const route = describeRoute({
  description: 'Delete a provider product',
  operationId: 'deleteProviderProduct',
  security: [
    {
      secretKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: resolver(z.object({ message: z.string() }))
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Products']
});

export type Route = typeof route;

export const registerProductsDeleteProviderProduct = (app: App) =>
  app.delete(
    '/v1/products/:productId/provider-products/:paymentProviderConfigurationId/:providerProductKey',
    route,
    zValidator('param', deleteProviderProductParamsSchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const productService = yield* ProductService;
              yield* productService
                .deletePaymentProviderProduct({
                  productId: c.req.param('productId'),
                  paymentProviderConfigurationId: c.req.param(
                    'paymentProviderConfigurationId'
                  ),
                  providerProductKey: c.req.param('providerProductKey')
                })
                .pipe(
                  Effect.catchTags({
                    ProductNotFound: (error) =>
                      Effect.fail(
                        new HonoErrorResponse({
                          code: 'NOT_FOUND',
                          message: error.message,
                          originalError: error
                        })
                      )
                  })
                );

              return c.json({ message: 'Provider product deleted' });
            })
          )
        )
      )
  );
