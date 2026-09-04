import type { SdkPerson } from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { CacheManager } from "../caching/cache-manager";
import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";
import { AuthGate } from "../network/auth-gate";
import { breakerKey, CircuitBreaker } from "../network/circuit-breaker";
import {
  countsTowardsBreaker,
  httpStatusOf,
  isAuthStatus,
  isRetryableStatus,
  withRequestTimeout,
} from "../network/policy";
import { ApiClient } from "../networking/api-client";
import { PlatformProvider } from "../platform/platform-provider";
import { SdkConfiguration } from "../sdk-configuration";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

class PersonAttributeSyncDeferred extends Schema.TaggedErrorClass<PersonAttributeSyncDeferred>()(
  "PersonAttributeSyncDeferred",
  { message: Schema.String },
) {}

/**
 * Developer-facing person attributes. `email` and `name` are reserved keys
 * mapped to the dedicated server fields; any other key is treated as a custom
 * trait.
 */
export interface PersonAttributes {
  email?: string;
  name?: string;
  [k: string]: unknown;
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
    traits: rest,
  };
};

const make = Effect.fn("makePersonAttributeManager")(function* effect() {
  const cacheManager = yield* CacheManager;
  const apiClient = yield* ApiClient;
  const authGate = yield* AuthGate;
  const breaker = yield* CircuitBreaker;
  const diagnostics = yield* Diagnostics;
  const sdkConfiguration = yield* SdkConfiguration;
  const personBreakerKey = breakerKey("config", sdkConfiguration.baseUrl);

  const getPersonAttributes = (distinctId: string) =>
    cacheManager
      .get<PersonAttributes>(generatePersonAttributesCacheKey(distinctId))
      .pipe(
        Effect.map(Option.match({ onNone: () => null, onSome: (attributes) => attributes.value })),
      );

  const cacheAttributes = (distinctId: string, attributes: PersonAttributes) =>
    cacheManager.set(generatePersonAttributesCacheKey(distinctId), attributes);

  /**
   * Performs the synchronous network sync of the given attributes for a
   * distinct id and returns the updated person snapshot. The reserved
   * `email`/`name` keys map to the dedicated server fields; everything else is
   * forwarded as `traits`. `setOnce`/`clientEventId` are intentionally omitted
   * — the server treats them as optional.
   */
  const syncPersonAttributes = (
    distinctId: string,
    attributes: PersonAttributes,
  ): Effect.Effect<SdkPerson, unknown, PlatformProvider | SdkConfiguration> =>
    Effect.gen(function* syncPersonAttributes() {
      if (authGate.isPaused()) {
        return yield* Effect.fail(
          new PersonAttributeSyncDeferred({ message: "Outbound requests are paused" }),
        );
      }
      const { email, name, traits } = splitReservedAttributes(attributes);
      const commonHeaders = yield* getCommonSdkHeaders();
      const allowed = yield* breaker.canAttempt(personBreakerKey, "syncPersonAttributes");
      if (!allowed) {
        return yield* Effect.fail(
          new PersonAttributeSyncDeferred({ message: "The API circuit is open" }),
        );
      }
      const outcome = yield* Effect.result(
        withRequestTimeout(
          "syncPersonAttributes",
          apiClient.sdk.syncPersonAttributes({
            headers: {
              ...commonHeaders,
              "x-distinct-id": distinctId,
            },
            payload: {
              email,
              name,
              traits,
            },
          }),
        ),
      );
      if (Result.isSuccess(outcome)) {
        yield* breaker.recordSuccess(personBreakerKey);
        return outcome.success;
      }

      const status = Option.getOrUndefined(httpStatusOf(outcome.failure));
      if (status !== undefined && isAuthStatus(status)) {
        yield* breaker.releaseProbe(personBreakerKey);
        yield* authGate.pause("syncPersonAttributes", status);
      } else if (status === undefined || countsTowardsBreaker(status)) {
        yield* breaker.recordFailure(personBreakerKey);
      } else {
        yield* breaker.releaseProbe(personBreakerKey);
      }
      if (status === undefined || isRetryableStatus(status)) {
        yield* diagnostics.emit({
          code: DIAGNOSTIC_CODES.REQUEST_FAILED,
          httpStatus: status,
          kind: "transport",
          message: "Person attributes were queued after the request failed",
          operation: "syncPersonAttributes",
          retryable: true,
        });
      }
      return yield* Effect.fail(outcome.failure);
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
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/PersonAttributeManager") {
  static Default = Layer.effect(PersonAttributeManager, make());
}
