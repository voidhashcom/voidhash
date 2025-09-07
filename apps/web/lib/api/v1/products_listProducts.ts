import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import { z } from 'zod';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { ProductService } from '@/lib/services/product.service';
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
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const productService = yield* ProductService;
        const environmentService = yield* EnvironmentService;
        const authSession = yield* authService.authenticateWithSecretKey();
        return yield* AuthSession.provide(authSession)(
          Effect.gen(function* () {
            const environment =
              yield* environmentService.getEnvironmentFromApiAuthSession();
            const projectId = yield* authService.getAuthorizedProjectId();
            const products = yield* Environment.provide(environment)(
              productService.getProducts(projectId)
            );
            return c.json<z.infer<typeof productResponseSchema>[]>(
              products.map((product) => ({
                productId: product.id,
                name: product.name
              }))
            );
          })
        );
      })
    )
  );

export type RouteResponse = z.infer<typeof productResponseSchema>[];
