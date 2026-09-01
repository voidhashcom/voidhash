import * as Effect from "effect/Effect";

export type PaymentProviderKind = "stripe" | "apple-app-store" | "google-play";

/**
 * Generic, strongly-typed provider adapter contract. Each payment provider
 * implements validation, key derivation, and the default configuration blobs
 * for its own typed global / product configuration shapes.
 *
 * This is the typed counterpart to the public {@link PaymentProviderShape}
 * (which erases the config types to `Record<string, unknown>` at the service
 * boundary). The App Store provider engine extends this so its `record*`
 * methods can see the concrete App Store configuration types.
 */
export interface PaymentProvider<
  TKind extends PaymentProviderKind,
  TGlobalConfiguration extends object,
  TProductConfiguration extends object,
> {
  readonly id: TKind;
  readonly title: string;
  readonly type: "native" | "web-checkout";
  readonly defaultGlobalConfiguration: () => Effect.Effect<TGlobalConfiguration>;
  readonly defaultProductConfiguration: () => Effect.Effect<TProductConfiguration>;
  readonly createGlobalKey: (configuration: TGlobalConfiguration) => Effect.Effect<string>;
  readonly createProductKey: (configuration: TProductConfiguration) => Effect.Effect<string>;
  readonly validateGlobalConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: TGlobalConfiguration;
      readonly paymentProviderKey: string;
    },
    unknown
  >;
  readonly validateProductConfiguration: (configuration: Record<string, unknown>) => Effect.Effect<
    {
      readonly parsedConfiguration: TProductConfiguration;
      readonly productKey: string;
    },
    unknown
  >;
}
