import { AppStoreServerSdk } from "@voidhash/app-store-server-sdk";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { FxRates, PurchaseProcessor } from "@voidhash/core-v2";

import { GooglePlayServerApi } from "../providers/google-play/sdk-context.ts";
import { IdentityProjectionPublisher } from "@voidhash/core/services/personIdentity/IdentityProjectionPublisher";
import { PersonIdentityService } from "@voidhash/core/services/personIdentity/PersonIdentityService";
import { PaymentConfigSecretCrypto } from "@voidhash/core/utils/crypto/PaymentConfigSecretCrypto";

const fxRates = FxRates.layer;

const purchaseProcessing = PurchaseProcessor.layer;

/** Identity publisher intentionally used by replay activities. */
export const WorkflowIdentityProjectionPublisherLive = IdentityProjectionPublisher.noop;

const personIdentity = PersonIdentityService.layer.pipe(
  Layer.provide(WorkflowIdentityProjectionPublisherLive),
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
