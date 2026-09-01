import type {
  PaymentProviderConfiguration as DbPaymentProviderConfiguration,
  ProviderEnvironmentValue,
} from "@voidhash/db";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { GooglePlayNormalizedPurchase } from "./helpers.ts";
import { GooglePlayPaymentProvider } from "./payment-provider.ts";

/** Canonical Google Play purchase data accepted by the record engine. */
export interface GooglePlayVerifiedPurchase {
  readonly providerEnvironment: ProviderEnvironmentValue;
  readonly purchase: GooglePlayNormalizedPurchase;
}

/** External Google Play fetch-and-normalization boundary. */
export interface GooglePlayPurchaseVerifierShape {
  readonly verify: (input: {
    readonly configuration: DbPaymentProviderConfiguration;
    readonly productId: string;
    readonly purchaseToken: string;
  }) => Effect.Effect<GooglePlayVerifiedPurchase, unknown>;
}

/** Fetches canonical purchase state for SDK-submitted Google Play tokens. */
export class GooglePlayPurchaseVerifier extends Context.Service<
  GooglePlayPurchaseVerifier,
  GooglePlayPurchaseVerifierShape
>()("@voidhash/backend/purchases/GooglePlayPurchaseVerifier") {
  static readonly layer = Layer.effect(
    GooglePlayPurchaseVerifier,
    Effect.gen(function* () {
      const provider = yield* GooglePlayPaymentProvider;

      return GooglePlayPurchaseVerifier.of({
        verify: (input) =>
          Effect.fn("verify")(function* () {
            const sdkContext = yield* provider.buildSdkContextFromConfiguration(
              input.configuration,
            );

            return yield* provider
              .fetchAndNormalizeSubscription(sdkContext, {
                purchaseToken: input.purchaseToken,
                subscriptionId: input.productId,
              })
              .pipe(
                Effect.catchTag("GooglePlayPurchaseNotFoundError", () =>
                  provider.fetchAndNormalizeProduct(sdkContext, {
                    purchaseToken: input.purchaseToken,
                    sku: input.productId,
                  }),
                ),
              );
          })(),
      });
    }),
  );
}
