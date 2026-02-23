import { Effect } from "effect";

import { CacheManager } from "../caching/cache-manager";
import { ApiClient } from "../networking/api-client";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

interface CustomerAttributes {
  email?: string;
  name?: string;
}

export class CustomerAttributeManager extends Effect.Service<CustomerAttributeManager>()(
  "rn-voidhash/CustomerAttributeManager",
  {
    dependencies: [CacheManager.Default],
    effect: Effect.gen(function* effect() {
      const cacheManager = yield* CacheManager;
      const apiClient = yield* ApiClient;

      const getCustomerAttributes = (appUserId: string) =>
        cacheManager
          .get<CustomerAttributes>(
            generateCustomerAttributesCacheKey(appUserId)
          )
          .pipe(Effect.map((attributes) => attributes?.value ?? null));

      const setCustomerAttributes = (
        appUserId: string,
        attributes: CustomerAttributes
      ) =>
        cacheManager.set(
          generateCustomerAttributesCacheKey(appUserId),
          attributes
        );

      const syncCustomerAttributes = (appUserId: string) =>
        Effect.gen(function* syncCustomerAttributes() {
          let attributes = yield* getCustomerAttributes(appUserId);
          if (!attributes) {
            attributes = {
              email: undefined,
              name: undefined,
            };
            yield* setCustomerAttributes(appUserId, attributes);
          }
          const commonHeaders = yield* getCommonSdkHeaders();
          yield* apiClient.sdk.syncCustomerAttributes({
            headers: {
              ...commonHeaders,
              "x-app-user-id": appUserId,
            },
            payload: {
              email: attributes.email,
              name: attributes.name,
            },
          });
        });

      const generateCustomerAttributesCacheKey = (appUserId: string) =>
        `customer-attributes:${appUserId}`;

      return {
        getCustomerAttributes,
        setCustomerAttributes,
        syncCustomerAttributes,
      } as const;
    }),
  }
) {}
