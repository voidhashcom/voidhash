import { zValidator } from '@hono/zod-validator';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import { authenticateWithSecretKey } from '@/lib/services/auth.service';
import { withEnvironmentFromApiKey } from '@/lib/services/environment.service';
import { ProductService } from '@/lib/services/product.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { getProductByIdParamsSchema, productResponseSchema } from './schema';

const route = describeRoute({
  description: 'Get a product',
  operationId: 'getProductById',
  security: [
    {
      secretKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': { schema: resolver(productResponseSchema) }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Products']
});

export type Route = typeof route;

export const registerProductsGetProductById = (app: App) =>
  app.get(
    '/v1/products/:productId',
    route,
    zValidator('param', getProductByIdParamsSchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const productService = yield* ProductService;
              const product = yield* productService.getProductById(
                c.req.param('productId')
              );

              if (!product) {
                return yield* Effect.fail(
                  new HonoErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Product not found'
                  })
                );
              }

              return c.json<z.infer<typeof productResponseSchema>>({
                productId: product.id,
                name: product.name
              });
            })
          )
        )
      )
  );

export type RouteResponse = z.infer<typeof productResponseSchema>;
