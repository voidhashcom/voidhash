import type { SdkResolvedPaywall } from "@voidhash/generated-clients";
import { Effect, Layer, ServiceMap } from "effect";

import { IdentityManager } from "../identity/identity-manager";
import { ApiClient } from "../networking/api-client";
import type { LocationSlug } from "../schema/registry";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";

/**
 * Release row of a resolved paywall showing, including the deploy-contract §6
 * `runtime` block for code releases (`null`/absent for visual-editor
 * releases). Passed through from the server response untouched.
 */
export type ResolvedPaywallRelease = NonNullable<
  SdkResolvedPaywall["showing"]["paywallRelease"]
>;

/**
 * The §6 runtime block of a code-release paywall: content-addressed identity,
 * the product slugs the paywall uses and the author-configured variables.
 */
export type PaywallReleaseRuntime = NonNullable<
  ResolvedPaywallRelease["runtime"]
>;

/**
 * Resolves the currently assigned paywall for a location slug. Stateless;
 * delegates to the SDK API with the standard SDK headers. The response is
 * returned as-is — including `showing.paywallRelease.runtime` when the active
 * release is a code release.
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
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
