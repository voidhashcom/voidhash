import { zValidator } from '@hono/zod-validator';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import {
  AuthService,
  authenticateWithSecretKey
} from '@/lib/services/auth.service';
import { withEnvironmentFromApiKey } from '@/lib/services/environment.service';
import { ProductService } from '@/lib/services/product.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { createProductBodySchema, productResponseSchema } from './schema';

const route = describeRoute({
  description: 'Create a new product',
  operationId: 'createProduct',
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

export const registerProductsCreateProduct = (app: App) =>
  app.post(
    '/v1/products',
    route,
    zValidator('json', createProductBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const authService = yield* AuthService;
              const productService = yield* ProductService;
              const projectId = yield* authService.getAuthorizedProjectId();
              const product = yield* productService
                .createProduct({
                  name: c.req.valid('json').name,
                  projectId
                })
                .pipe(
                  Effect.flatMap((createdProduct) =>
                    productService.getProductById(createdProduct.id)
                  )
                );
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
export type RouteRequest = z.infer<typeof createProductBodySchema>;
