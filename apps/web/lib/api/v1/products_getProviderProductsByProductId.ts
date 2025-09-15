import { zValidator } from '@hono/zod-validator';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import { z } from 'zod';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import { authenticateWithSecretKey } from '@/lib/services/auth.service';
import { withEnvironmentFromApiKey } from '@/lib/services/environment.service';
import { ProductService } from '@/lib/services/product.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import {
  getProviderProductsParamsSchema,
  providerProductResponseSchema
} from './schema';

const route = describeRoute({
  description: 'Get all provider products for a product',
  operationId: 'getProviderProductsByProductId',
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
          schema: resolver(z.array(providerProductResponseSchema))
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Products']
});

export type Route = typeof route;

export const registerProductsGetProviderProductsByProductId = (app: App) =>
  app.get(
    '/v1/products/:productId/provider-products',
    route,
    zValidator('param', getProviderProductsParamsSchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const productService = yield* ProductService;
              const providerProducts =
                yield* productService.getProviderProductsByProductId(
                  c.req.param('productId')
                );

              return c.json<z.infer<typeof providerProductResponseSchema>[]>(
                // @ts-expect-error - TODO: fix this
                providerProducts.map((providerProduct) => ({
                  providerProductKey: providerProduct.providerProductKey,
                  providerConfiguration: {
                    paymentProviderConfigurationId:
                      providerProduct.paymentProviderConfigurationId,
                    configuration: providerProduct.configuration
                  }
                }))
              );
            })
          )
        )
      )
  );

export type RouteResponse = z.infer<typeof providerProductResponseSchema>[];
