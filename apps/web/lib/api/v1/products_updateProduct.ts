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
import { ProductService } from '@/lib/services/product.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import {
  productResponseSchema,
  updateProductBodySchema,
  updateProductParamsSchema
} from './schema';

const route = describeRoute({
  description: 'Update a product',
  operationId: 'updateProduct',
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

export const registerProductsUpdateProduct = (app: App) =>
  app.put(
    '/v1/products/:productId',
    route,
    zValidator('param', updateProductParamsSchema),
    zValidator('json', updateProductBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          Effect.gen(function* () {
            const productService = yield* ProductService;
            const productId = c.req.param('productId');
            const name = c.req.valid('json').name;
            yield* productService
              .updateProduct({
                productId,
                name
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
            const product = yield* productService.getProductById(productId);

            return c.json<z.infer<typeof productResponseSchema>>({
              productId: product.id,
              name: product.name
            });
          })
        )
      )
  );

export type RouteResponse = z.infer<typeof productResponseSchema>;
export type RouteRequest = z.infer<typeof updateProductBodySchema>;
