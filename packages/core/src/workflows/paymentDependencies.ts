import { AppStoreServerSdk } from "@voidhash/app-store-server-sdk";
import { Config, Effect, Layer, Redacted } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

import { FxRateService } from "../services/fxRates/FxRateService.ts";
import { GooglePlayServerApi } from "../services/paymentProviders/googlePlay/sdk-context.ts";
import { PerkGrantService } from "../services/perkGrants/PerkGrantService.ts";
import { IdentityProjectionPublisher } from "../services/personIdentity/IdentityProjectionPublisher.ts";
import { PersonIdentityService } from "../services/personIdentity/PersonIdentityService.ts";
import { PurchaseProcessingService } from "../services/purchaseProcessing/PurchaseProcessingService.ts";
import { PaymentConfigSecretCrypto } from "../utils/crypto/PaymentConfigSecretCrypto.ts";

const fxRates = FxRateService.layer({
  apiKey: Config.redacted("EXCHANGE_RATE_API_KEY").pipe(
    Config.withDefault(Redacted.make("")),
    Effect.map(Redacted.value),
    Effect.orDie,
  ),
  baseUrl: Config.string("EXCHANGE_RATE_API_BASE_URL").pipe(
    Config.withDefault("https://v6.exchangerate-api.com/v6"),
    Effect.orDie,
  ),
});

const purchaseProcessing = PurchaseProcessingService.layer.pipe(
  Layer.provide(PerkGrantService.layer),
);

const personIdentity = PersonIdentityService.layer.pipe(
  Layer.provide(IdentityProjectionPublisher.noop),
);

const paymentCrypto = PaymentConfigSecretCrypto.layer({
  key: Config.redacted("ENCRYPTION_KEY").pipe(
    Config.withDefault(Redacted.make("")),
    Effect.map(Redacted.value),
    Effect.orDie,
  ),
});

/** Shared dependencies for App Store workflow activities. */
export const appStore = Layer.mergeAll(
  AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer)),
  fxRates,
  purchaseProcessing,
  personIdentity,
  paymentCrypto,
);

/** Shared dependencies for Google Play workflow activities. */
export const googlePlay = Layer.mergeAll(
  GooglePlayServerApi.layer.pipe(Layer.provide(FetchHttpClient.layer)),
  fxRates,
  purchaseProcessing,
  personIdentity,
  paymentCrypto,
);

/** Shared dependencies for Stripe workflow activities. */
export const stripe = Layer.mergeAll(
  FetchHttpClient.layer,
  fxRates,
  purchaseProcessing,
  personIdentity,
  paymentCrypto,
);
