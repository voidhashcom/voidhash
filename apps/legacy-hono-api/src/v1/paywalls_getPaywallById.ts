import { zValidator } from '@hono/zod-validator';
import {
  authenticateWithSecretKey,
  PaywallService
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { getPaywallByIdParamsSchema, paywallResponseSchema } from './schema';

const route = describeRoute({
  description: 'Get a paywall',
  operationId: 'getPaywallById',
  security: [
    {
      secretKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': { schema: resolver(paywallResponseSchema) }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Paywalls']
});

export type Route = typeof route;

export const registerPaywallsGetPaywallById = (app: App) =>
  app.get(
    '/v1/paywalls/:paywallId',
    route,
    zValidator('param', getPaywallByIdParamsSchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          Effect.gen(function* () {
            const paywallService = yield* PaywallService;
            const paywall = yield* paywallService
              .getPaywallById(c.req.param('paywallId'))
              .pipe(
                Effect.catchTags({
                  PaywallNotFoundError: () =>
                    Effect.fail(
                      new HonoErrorResponse({
                        code: 'NOT_FOUND',
                        message: 'Paywall not found'
                      })
                    )
                })
              );

            return c.json<z.infer<typeof paywallResponseSchema>>({
              paywallId: paywall.id,
              name: paywall.name
            });
          })
        )
      )
  );
