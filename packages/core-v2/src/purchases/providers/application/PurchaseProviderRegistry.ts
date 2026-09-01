import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { PaymentProviderConfigurationValidationError } from "../../domain/ProviderConfiguration.ts";
import type { PaymentProviderProductValidationError } from "../../domain/ProviderProduct.ts";

export type PaymentProviderKind = "stripe" | "apple-app-store" | "google-play";

/**
 * Shape of the low-level provider adapter consumed by
 * `PaymentProviderConfigurationService` and `PaymentProviderProductService`.
 * Each provider implements validation, key derivation, and the default
 * configuration blobs for its own configuration / product types.
 *
 * Provider implementations live beside this contract under `stripe/`,
 * `appStore/`, and `googlePlay/`. The application composition provides their
 * configuration adapters under these tags.
 */
export interface PaymentProviderShape<TKind extends PaymentProviderKind> {
  readonly id: TKind;
  readonly title: string;
  readonly type: "native" | "web-checkout";
  readonly defaultGlobalConfiguration: () => Effect.Effect<Record<string, unknown>>;
  readonly defaultProductConfiguration: () => Effect.Effect<Record<string, unknown>>;
  readonly createGlobalKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly createProductKey: (configuration: Record<string, unknown>) => Effect.Effect<string>;
  readonly validateGlobalConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: Record<string, unknown>;
      readonly paymentProviderKey: string;
    },
    PaymentProviderConfigurationValidationError
  >;
  readonly validateProductConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: Record<string, unknown>;
      readonly productKey: string;
    },
    PaymentProviderProductValidationError
  >;
}

export class StripePaymentProvider extends Context.Service<
  StripePaymentProvider,
  PaymentProviderShape<"stripe">
>()("@voidhash/core-v2/purchases/providers/StripePaymentProvider") {}

export class AppStorePaymentProvider extends Context.Service<
  AppStorePaymentProvider,
  PaymentProviderShape<"apple-app-store">
>()("@voidhash/core-v2/purchases/providers/AppStorePaymentProvider") {}

export class GooglePlayPaymentProvider extends Context.Service<
  GooglePlayPaymentProvider,
  PaymentProviderShape<"google-play">
>()("@voidhash/core-v2/purchases/providers/GooglePlayPaymentProvider") {}

export type AnyPaymentProviderShape =
  | PaymentProviderShape<"stripe">
  | PaymentProviderShape<"apple-app-store">
  | PaymentProviderShape<"google-play">;
