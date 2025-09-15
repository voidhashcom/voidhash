import { zValidator } from '@hono/zod-validator';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import { NotFoundError } from '@/lib/effect/errors';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import {
  AuthService,
  authenticateWithSecretKey
} from '@/lib/services/auth.service';
import { withEnvironmentFromApiKey } from '@/lib/services/environment.service';

import { PaywallService } from '@/lib/services/paywall.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { createPaywallBodySchema, paywallResponseSchema } from './schema';

const route = describeRoute({
  description: 'Create a new paywall',
  operationId: 'createPaywall',
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

export const registerPaywallsCreatePaywall = (app: App) =>
  app.post(
    '/v1/paywalls',
    route,
    zValidator('json', createPaywallBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const authService = yield* AuthService;
              const paywallService = yield* PaywallService;

              const projectId = yield* authService.getAuthorizedProjectId();
              const createdPaywall = yield* paywallService.createPaywall({
                name: c.req.valid('json').name,
                projectId
              });

              const refreshedPaywall = yield* paywallService
                .getPaywallById(createdPaywall.id)
                .pipe(
                  Effect.catchTags({
                    PaywallNotFoundError: (error) =>
                      Effect.fail(new NotFoundError({ message: error.message }))
                  })
                );

              if (!refreshedPaywall) {
                // Should never happen, because the paywall was created above
                return yield* Effect.die(new Error('Paywall not found'));
              }

              return c.json<z.infer<typeof paywallResponseSchema>>({
                paywallId: refreshedPaywall.id,
                name: refreshedPaywall.name
              });
            })
          )
        )
      )
  );
