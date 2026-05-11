import { Effect, Layer, ServiceMap } from "effect";

import { IdentityManager } from "../identity/identity-manager";
import { ApiClient } from "../networking/api-client";
import type { LocationSlug } from "../schema/registry";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

/**
 * Resolves the currently assigned paywall for a location slug. Stateless;
 * delegates to the SDK API with the standard SDK headers.
 */
export class PaywallService extends ServiceMap.Service<PaywallService>()(
  "rn-voidhash/PaywallService",
  {
    make: Effect.gen(function* () {
      const apiClient = yield* ApiClient;
      const identityManager = yield* IdentityManager;

      const getPaywallForLocation = (locationSlug: LocationSlug) =>
        Effect.gen(function* () {
          const commonHeaders = yield* getCommonSdkHeaders();
          const distinctId = yield* identityManager.getDistinctId();
          return yield* apiClient.sdk.resolvePaywall({
            headers: {
              ...commonHeaders,
              "x-distinct-id": distinctId,
            },
            payload: { locationSlug: String(locationSlug) },
          });
        });

      return { getPaywallForLocation } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make);
}
