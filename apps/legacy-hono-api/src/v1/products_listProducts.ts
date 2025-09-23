import {
  AuthService,
  authenticateWithSecretKey,
  ProductService,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import { z } from 'zod';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { productResponseSchema } from './schema';

const route = describeRoute({
  description: 'List products',
  operationId: 'listProducts',
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
          schema: resolver(z.array(productResponseSchema))
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Products']
});

export type Route = typeof route;

export const registerProductsListProducts = (app: App) =>
  app.get('/v1/products', route, async (c) =>
    createEffectHandler(c)(
      authenticateWithSecretKey(
        withEnvironmentFromApiKey()(
          Effect.gen(function* () {
            const authService = yield* AuthService;
            const productService = yield* ProductService;
            const projectId = yield* authService.getAuthorizedProjectId();
            const products = yield* productService.getProducts(projectId);
            return c.json<z.infer<typeof productResponseSchema>[]>(
              products.map((product) => ({
                productId: product.id,
                name: product.name
              }))
            );
          })
        )
      )
    )
  );

export type RouteResponse = z.infer<typeof productResponseSchema>[];
