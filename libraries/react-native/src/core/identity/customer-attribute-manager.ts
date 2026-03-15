import { Effect, Layer, ServiceMap } from "effect";

import { CacheManager } from "../caching/cache-manager";
import { ApiClient } from "../networking/api-client";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

interface CustomerAttributes {
  email?: string;
  name?: string;
}

const make = Effect.gen(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;

  const getCustomerAttributes = (distinctId: string) =>
    cacheManager
      .get<CustomerAttributes>(
        generateCustomerAttributesCacheKey(distinctId)
      )
      .pipe(Effect.map((attributes) => attributes?.value ?? null));

  const setCustomerAttributes = (
    distinctId: string,
    attributes: CustomerAttributes
  ) =>
    cacheManager.set(
      generateCustomerAttributesCacheKey(distinctId),
      attributes
    );

  const syncCustomerAttributes = (distinctId: string) =>
    Effect.gen(function* syncCustomerAttributes() {
      let attributes = yield* getCustomerAttributes(distinctId);
      if (!attributes) {
        attributes = {
          email: undefined,
          name: undefined,
        };
        yield* setCustomerAttributes(distinctId, attributes);
      }
      const commonHeaders = yield* getCommonSdkHeaders();
      yield* apiClient.sdk.syncCustomerAttributes({
        headers: {
          ...commonHeaders,
          "x-distinct-id": distinctId,
        },
        payload: {
          email: attributes.email,
          name: attributes.name,
        },
      });
    });

  const generateCustomerAttributesCacheKey = (distinctId: string) =>
    `customer-attributes:${distinctId}`;

  return {
    getCustomerAttributes,
    setCustomerAttributes,
    syncCustomerAttributes,
  } as const;
});

export class CustomerAttributeManager extends ServiceMap.Service<CustomerAttributeManager, Effect.Success<typeof make>>()("rn-voidhash/CustomerAttributeManager") {
  static Default = Layer.effect(CustomerAttributeManager, make).pipe(
    Layer.provide(CacheManager.Default)
  )
}
