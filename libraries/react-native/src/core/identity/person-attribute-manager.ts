import { Effect, Layer, Context } from "effect";

import { CacheManager } from "../caching/cache-manager";
import { ApiClient } from "../networking/api-client";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

/**
 * Developer-facing person attributes. `email` and `name` are reserved keys
 * mapped to the dedicated server fields; any other key is treated as a custom
 * trait.
 */
export interface PersonAttributes {
  email?: string;
  name?: string;
  [k: string]: string | number | boolean | null | undefined;
}

/**
 * Splits the reserved `email`/`name` keys from the remaining custom traits so
 * the reserved values can be sent on their dedicated server fields and the
 * rest forwarded as a `traits` record.
 */
export const splitReservedAttributes = (attributes: PersonAttributes) => {
  const { email, name, ...rest } = attributes;
  return {
    email,
    name,
    traits: rest as Record<string, unknown>,
  };
};

const make = Effect.gen(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;

  const getPersonAttributes = (distinctId: string) =>
    cacheManager
      .get<PersonAttributes>(generatePersonAttributesCacheKey(distinctId))
      .pipe(Effect.map((attributes) => attributes?.value ?? null));

  const cacheAttributes = (distinctId: string, attributes: PersonAttributes) =>
    cacheManager.set(generatePersonAttributesCacheKey(distinctId), attributes);

  /**
   * Performs the synchronous network sync of the given attributes for a
   * distinct id and returns the updated person snapshot. The reserved
   * `email`/`name` keys map to the dedicated server fields; everything else is
   * forwarded as `traits`. `setOnce`/`clientEventId` are intentionally omitted
   * — the server treats them as optional.
   */
  const syncPersonAttributes = (distinctId: string, attributes: PersonAttributes) =>
    Effect.gen(function* syncPersonAttributes() {
      const { email, name, traits } = splitReservedAttributes(attributes);
      const commonHeaders = yield* getCommonSdkHeaders();
      return yield* apiClient.sdk.syncPersonAttributes({
        headers: {
          ...commonHeaders,
          "x-distinct-id": distinctId,
        },
        payload: {
          email,
          name,
          traits,
        },
      });
    });

  const generatePersonAttributesCacheKey = (distinctId: string) =>
    `person-attributes:${distinctId}`;

  return {
    cacheAttributes,
    getPersonAttributes,
    syncPersonAttributes,
  } as const;
});

export class PersonAttributeManager extends Context.Service<
  PersonAttributeManager,
  Effect.Success<typeof make>
>()("rn-voidhash/PersonAttributeManager") {
  static Default = Layer.effect(PersonAttributeManager, make).pipe(
    Layer.provide(CacheManager.Default),
  );
}
