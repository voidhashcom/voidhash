import { AppStoreServerSdk } from "@voidhash/app-store-server-sdk";
import {
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
} from "@voidhash/core/services";
import { FxRateService } from "@voidhash/core/services/fxRates/FxRateService";
import { AppStoreWebhookHandlerService } from "@voidhash/core/services/paymentProviders/appStore/app-store-webhook-handler-service";
import { AppStorePaymentProvider } from "@voidhash/core/services/paymentProviders/appStore/payment-provider";
import { AppStoreReconciliationService } from "@voidhash/core/services/paymentProviders/appStore/app-store-reconciliation-service";
import { GooglePlayWebhookHandlerService } from "@voidhash/core/services/paymentProviders/googlePlay/webhook-handler-service";
import { GooglePlayServerApi } from "@voidhash/core/services/paymentProviders/googlePlay/sdk-context";
import { StripeWebhookHandlerService } from "@voidhash/core/services/paymentProviders/stripe/stripe-webhook-handler-service";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";
import { Db } from "@voidhash/db";
import { Effect, Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

const fxRates = FxRateService.layer({
  apiKey: Effect.sync(() => process.env.EXCHANGE_RATE_API_KEY ?? ""),
  baseUrl: Effect.sync(
    () => process.env.EXCHANGE_RATE_API_BASE_URL ?? "https://v6.exchangerate-api.com/v6",
  ),
});

const purchaseProcessing = PurchaseProcessingService.layer.pipe(
  Layer.provide(PerkGrantService.layer),
);

const personIdentity = PersonIdentityService.layer.pipe(
  Layer.provide(IdentityProjectionPublisher.noop),
);

const paymentCrypto = PaymentConfigSecretCrypto.layer({
  key: Effect.sync(() => process.env.ENCRYPTION_KEY ?? ""),
});

const appStoreRuntime = Layer.mergeAll(
  AppStoreServerSdk.layer.pipe(Layer.provide(FetchHttpClient.layer)),
  fxRates,
  purchaseProcessing,
  personIdentity,
  paymentCrypto,
);

const googlePlayRuntime = Layer.mergeAll(
  GooglePlayServerApi.layer.pipe(Layer.provide(FetchHttpClient.layer)),
  fxRates,
  purchaseProcessing,
  personIdentity,
  paymentCrypto,
);

const stripeRuntime = Layer.mergeAll(
  FetchHttpClient.layer,
  fxRates,
  purchaseProcessing,
  personIdentity,
  paymentCrypto,
);

/** Builds the App Store parked-notification handler for a self-host database. */
export const makeAppStoreReplayHandlerLive = (database: Layer.Layer<Db>) =>
  AppStoreWebhookHandlerService.layer.pipe(
    Layer.provide(appStoreRuntime),
    Layer.provide(database),
  );

/** Builds the App Store reconciliation handler for a self-host database. */
export const makeAppStoreReconciliationLive = (database: Layer.Layer<Db>) =>
  AppStoreReconciliationService.layer.pipe(
    Layer.provide(AppStorePaymentProvider.layer),
    Layer.provide(appStoreRuntime),
    Layer.provide(database),
  );

/** Builds the Google Play parked-notification handler for a self-host database. */
export const makeGooglePlayReplayHandlerLive = (database: Layer.Layer<Db>) =>
  GooglePlayWebhookHandlerService.layer.pipe(
    Layer.provide(googlePlayRuntime),
    Layer.provide(database),
  );

/** Builds the Stripe parked-notification handler for a self-host database. */
export const makeStripeReplayHandlerLive = (database: Layer.Layer<Db>) =>
  StripeWebhookHandlerService.layer.pipe(
    Layer.provide(stripeRuntime),
    Layer.provide(database),
  );
