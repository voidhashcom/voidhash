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
  providerProductResponseSchema,
  updateProviderProductBodySchema,
  updateProviderProductParamsSchema
} from './schema';

const route = describeRoute({
  description: 'Update a provider product',
  operationId: 'updateProviderProduct',
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

export const registerProductsUpdateProviderProduct = (app: App) =>
  app.put(
    '/v1/products/:productId/provider-products/:paymentProviderConfigurationProductId',
    route,
    zValidator('param', updateProviderProductParamsSchema),
    zValidator('json', updateProviderProductBodySchema),
    async (c) =>
      createEffectHandler(c)(
        authenticateWithSecretKey(
          withEnvironmentFromApiKey()(
            Effect.gen(function* () {
              const productService = yield* ProductService;
              const paymentProviderConfigurationProductId = c.req.param(
                'paymentProviderConfigurationProductId'
              );
              const configuration = c.req.valid('json');

              yield* productService.updatePaymentProviderProduct({
                paymentProviderConfigurationProductId,
                configuration: configuration.configuration
              });

              // Get the updated provider product to return full details
              const providerProduct =
                yield* productService.getProviderProductById(
                  paymentProviderConfigurationProductId
                );

              return c.json({
                providerProductKey: providerProduct.providerProductKey,
                providerConfiguration: {
                  configuration: providerProduct.configuration,
                  paymentProviderConfigurationId:
                    providerProduct.paymentProviderConfigurationId
                }
              });
            }).pipe(
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
                      code: 'BAD_REQUEST',
                      message: error.message,
                      originalError: error
                    })
                  ),
                PaymentProviderNotFound: (error) =>
                  Effect.fail(
                    new HonoErrorResponse({
                      code: 'BAD_REQUEST',
                      message: error.message,
                      originalError: error
                    })
                  ),
                ProviderProductNotFound: (error) =>
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
            )
          )
        )
      )
  );

export type RouteResponse = z.infer<typeof providerProductResponseSchema>;
export type RouteRequest = z.infer<typeof updateProviderProductBodySchema>;
