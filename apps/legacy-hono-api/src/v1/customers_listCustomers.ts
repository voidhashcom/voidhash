import {
  AuthService,
  authenticateWithSecretKey,
  CustomerService,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import { z } from 'zod';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { customerResponseSchema } from './schema';

const route = describeRoute({
  description: 'List customers',
  operationId: 'listCustomers',
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
          schema: resolver(z.array(customerResponseSchema))
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Customers']
});

export type Route = typeof route;

export const registerCustomersListCustomers = (app: App) =>
  app.get('/v1/customers', route, async (c) =>
    createEffectHandler(c)(
      Effect.gen(function* () {
        return yield* authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const authService = yield* AuthService;
              const customerService = yield* CustomerService;
              const projectId = yield* authService.getAuthorizedProjectId();
              const customers = yield* customerService.getCustomers({
                projectId
              });

              return c.json<z.infer<typeof customerResponseSchema>[]>(
                customers.map((customer) => ({
                  customerId: customer.id,
                  name: customer.name ?? null,
                  email: customer.email,
                  appUserId: customer.appUserId ?? null,
                  origin: customer.origin
                }))
              );
            })
          )
        );
      })
    )
  );
