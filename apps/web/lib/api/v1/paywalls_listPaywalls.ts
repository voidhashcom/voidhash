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
import { PaywallService } from '@/lib/services/paywall.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { paywallResponseSchema } from './schema';

const route = describeRoute({
  description: 'List paywalls',
  operationId: 'listPaywalls',
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
          schema: resolver(z.array(paywallResponseSchema))
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Paywalls']
});

export type Route = typeof route;

export const registerPaywallsListPaywalls = (app: App) =>
  app.get('/v1/paywalls', route, async (c) =>
    createEffectHandler(c)(
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const paywallService = yield* PaywallService;
        const environmentService = yield* EnvironmentService;
        const authSession = yield* authService.authenticateWithSecretKey();
        return yield* AuthSession.provide(authSession)(
          Effect.gen(function* () {
            const environment =
              yield* environmentService.getEnvironmentFromApiAuthSession();
            const projectId = yield* authService.getAuthorizedProjectId();
            const paywalls = yield* Environment.provide(environment)(
              paywallService.getPaywalls(projectId)
            );

            return c.json<z.infer<typeof paywallResponseSchema>[]>(
              paywalls.map((paywall) => ({
                paywallId: paywall.id,
                name: paywall.name,
                projectId: paywall.projectId
              }))
            );
          })
        );
      })
    )
  );
