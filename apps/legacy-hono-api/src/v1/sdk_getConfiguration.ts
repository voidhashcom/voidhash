import {
  authenticateWithPublishableKey,
  SdkService,
  withEnvironmentFromApiKey
} from '@voidhash/core/services';
import { Effect } from 'effect';
import { describeRoute } from 'hono-openapi';
import { resolver } from 'hono-openapi/zod';
import type { z } from 'zod';
import { createEffectHandler } from '@/lib/effect/runtimes/hono';
import { openApiErrorResponses } from '../errors/openapi_responses';
import type { App } from '../hono/app';
import {
  type sdkGetConfigurationResponseSchema,
  sdkPaywallResponseSchema
} from './schema';

const route = describeRoute({
  description: 'Get paywall by location',
  operationId: 'sdkGetPaywallByLocation',
  security: [
    {
      publishableKey: []
    }
  ],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': { schema: resolver(sdkPaywallResponseSchema) }
      }
    },
    ...openApiErrorResponses
  },
  tags: ['SDK']
});

export type Route = typeof route;

export const registerSdkGetConfiguration = (app: App) =>
  app.post('/v1/sdk/get-configuration', route, async (c) =>
    createEffectHandler(c)(
      authenticateWithPublishableKey(
        withEnvironmentFromApiKey()(
          Effect.gen(function* () {
            const sdkService = yield* SdkService;
            const configuration = yield* sdkService.getConfiguration();
            return c.json<z.infer<typeof sdkGetConfigurationResponseSchema>>({
              paywalls: configuration.paywalls.map((paywall) => {
                return {
                  paywallId: paywall.id,
                  paywallProducts: paywall.paywallProducts.map(
                    (paywallProduct) => {
                      return {
                        paywallProductId: paywallProduct.id,
                        productId: paywallProduct.product.id,
                        displayName: paywallProduct.product.name,
                        nativePaymentProviderConfigurationProductId:
                          paywallProduct.webCheckoutPaymentProviderConfigurationProductId,
                        defaultWebCheckoutPaymentProviderConfigurationProductId:
                          paywallProduct.webCheckoutPaymentProviderConfigurationProductId,
                        paymentProviderConfigurationProducts:
                          paywallProduct.product.paymentProviderConfigurationProducts.map(
                            (paymentProviderConfigurationProduct) => {
                              return {
                                paymentProviderConfigurationProductId:
                                  paymentProviderConfigurationProduct.id,
                                paymentProviderConfigurationId:
                                  paymentProviderConfigurationProduct.paymentProviderConfigurationId,
                                configuration:
                                  paymentProviderConfigurationProduct.configuration ??
                                  {}
                              };
                            }
                          )
                      };
                    }
                  )
                };
              }),
              paywallLocations: configuration.paywallLocations.map(
                (paywallLocation) => {
                  return {
                    paywallLocationId: paywallLocation.id,
                    slug: paywallLocation.slug
                  };
                }
              ),
              placements: configuration.placements,
              paymentProviderConfigurations:
                configuration.paymentProviderConfigurations.map(
                  (paymentProviderConfiguration) => {
                    return {
                      paymentProviderConfigurationId:
                        paymentProviderConfiguration.id,
                      providerId: paymentProviderConfiguration.providerId
                    };
                  }
                )
            });
          }).pipe(Effect.catchTags({}))
        )
      )
    )
  );
