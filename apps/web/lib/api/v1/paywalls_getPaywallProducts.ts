import { zValidator } from '@hono/zod-validator';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import { z } from 'zod';
import { NotFoundError } from '@/lib/effect/errors';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { PaywallService } from '@/lib/services/paywall.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import {
  getPaywallProductsParamsSchema,
  paywallProductResponseSchema
} from './schema';

const route = describeRoute({
  description: 'Get all products for a paywall',
  operationId: 'getPaywallProducts',
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
          schema: resolver(z.array(paywallProductResponseSchema))
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Paywalls']
});

export type Route = typeof route;

export const registerPaywallsGetPaywallProducts = (app: App) =>
  app.get(
    '/v1/paywalls/:paywallId/products',
    route,
    zValidator('param', getPaywallProductsParamsSchema),
    async (c) =>
      createEffectHandler(c)(
        Effect.gen(function* () {
          const authService = yield* AuthService;
          const authSession = yield* authService.authenticateWithSecretKey();
          return yield* AuthSession.provide(authSession)(
            Effect.gen(function* () {
              const paywallService = yield* PaywallService;
              const paywallProducts = yield* paywallService
                .getPaywallProducts(c.req.param('paywallId'))
                .pipe(
                  Effect.catchTags({
                    PaywallNotFoundError: (error) =>
                      Effect.fail(new NotFoundError({ message: error.message }))
                  })
                );
              return c.json<z.infer<typeof paywallProductResponseSchema>[]>(
                paywallProducts.map((pp) => ({
                  paywallId: pp.paywallId,
                  productId: pp.productId,
                  productName: pp.product.name ?? null
                }))
              );
            })
          );
        })
      )
  );
