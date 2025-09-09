import { zValidator } from '@hono/zod-validator';
import {
  authenticateWithSecretKey,
  ProductService,
  withEnvironmentFromApiKey
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
import {
  attachProviderProductBodySchema,
  attachProviderProductParamsSchema,
  providerProductResponseSchema
} from './schema';

const route = describeRoute({
  description: 'Attach a new provider product',
  operationId: 'attachProviderProduct',
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
          schema: resolver(providerProductResponseSchema)
        }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['Products']
});

export type Route = typeof route;

export const registerProductsAttachProviderProduct = (app: App) =>
  app.post(
    '/v1/products/:productId/provider-products',
    route,
    zValidator('param', attachProviderProductParamsSchema),
    zValidator('json', attachProviderProductBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const productService = yield* ProductService;
              const result = yield* productService
                .createPaymentProviderProduct({
                  productId: c.req.param('productId'),
                  paymentProviderConfigurationId:
                    c.req.valid('json').paymentProviderConfigurationId,
                  configuration: c.req.valid('json').configuration
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
                      ),
                    PaymentProviderConfigurationNotFound: (error) =>
                      Effect.fail(
                        new HonoErrorResponse({
                          code: 'NOT_FOUND',
                          message: error.message,
                          originalError: error
                        })
                      ),
                    PaymentProviderNotFound: (error) =>
                      Effect.fail(
                        new HonoErrorResponse({
                          code: 'NOT_FOUND',
                          message: error.message,
                          originalError: error
                        })
                      ),
                    InvalidConfiguration: (error) =>
                      Effect.fail(
                        new HonoErrorResponse({
                          code: 'BAD_REQUEST',
                          message: error.message,
                          originalError: error
                        })
                      )
                  })
                );
              return c.json<z.infer<typeof providerProductResponseSchema>>({
                providerProductKey: result.providerProductKey,
                providerConfiguration: {
                  paymentProviderConfigurationId:
                    result.paymentProviderConfigurationId,
                  configuration: result.configuration
                }
              });
            })
          )
        )
      )
  );

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof attachProviderProductBodySchema>;
