import { zValidator } from '@hono/zod-validator';
import { CustomerOrigin } from '@voidhash/db';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import {
  createEffectHandler,
  HonoErrorResponse
} from '@/lib/effect/runtimes/hono';
import {
  AuthService,
  authenticateWithSecretKey
} from '@/lib/services/auth.service';
import { CustomerService } from '@/lib/services/customer.service';
import {
  Environment,
  withEnvironmentFromApiKey
} from '@/lib/services/environment.service';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import { createCustomerBodySchema, customerResponseSchema } from './schema';

const route = describeRoute({
  description: 'Create a new customer',
  operationId: 'createCustomer',
  security: [
    {
      secretKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': { schema: resolver(customerResponseSchema) }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Customers']
});

export type Route = typeof route;

export const registerCustomersCreateCustomer = (app: App) =>
  app.post(
    '/v1/customers',
    route,
    zValidator('json', createCustomerBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const customerService = yield* CustomerService;
              const authService = yield* AuthService;
              const environment = yield* Environment;

              const projectId = yield* authService.getAuthorizedProjectId();
              const customer = yield* customerService
                .createCustomer({
                  appUserId: c.req.valid('json').appUserId,
                  origin: CustomerOrigin.API,
                  projectId,
                  environment
                })
                .pipe(
                  Effect.catchTags({
                    InvalidAnonymousIdError: (error) =>
                      Effect.fail(
                        new HonoErrorResponse({
                          code: 'BAD_REQUEST',
                          message: error.message
                        })
                      )
                  })
                );

              return c.json<z.infer<typeof customerResponseSchema>>({
                customerId: customer.id,
                name: customer.name ?? null,
                email: customer.email ?? null,
                appUserId: customer.appUserId ?? null
              });
            })
          )
        )
      )
  );

export type CustomersCreateCustomerRequestBody = z.infer<
  typeof createCustomerBodySchema
>;

export type CustomersCreateCustomerResponse = z.infer<
  typeof customerResponseSchema
>;
