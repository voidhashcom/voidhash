import type { SubscriptionProduct } from "../entities/product";
import type { PerkDefinition } from "./perk";
import type { PaywallLocationDefinition } from "./paywall-location";
import type { ProductDefinition } from "./products/base";

export type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

// ===============================
// Payment Providers
// ===============================

export interface GooglePlayProductConfiguration {
  /**
   * The unique identifier for the in-app product or subscription as configured in the Google Play Console.
   * For subscriptions, this is the subscription product ID.
   */
  productId: string;
}

export type GooglePlaySubscriptionProductConfiguration =
  GooglePlayProductConfiguration & {
    /**
     * The unique identifier for the base plan within a subscription product in the Google Play Console.
     * This field is only relevant for subscription products. For one-time products, leave undefined.
     */
    basePlanId?: string;
  };

export interface AppleAppStoreProductConfiguration {
  /**
   * The unique identifier for the in-app purchase or subscription as configured in App Store Connect.
   */
  productId: string;
}

export interface PaymentProviders {
  googlePlay: {
    definition: true;
    productTypes: {
      subscription: GooglePlaySubscriptionProductConfiguration;
    };
  };
  appleAppStore: {
    definition: true;
    productTypes: {
      subscription: AppleAppStoreProductConfiguration;
    };
  };
}

// ===============================
// Definitions
// ===============================

export type DefinedProviders = {
  [K in keyof PaymentProviders]?: PaymentProviders[K]["definition"];
};

export type DefinedPerks = Record<string, PerkDefinition>;

// ===============================
// Products
// ===============================

export interface BaseProductDefinitionProperties {
  name: string;
}

export type InferProductConfigurationProviders<
  TDefinedProviders extends DefinedProviders,
> = {
  [K in keyof TDefinedProviders]: TDefinedProviders[K] extends true
    ? K extends keyof PaymentProviders
      ? PaymentProviders[K]["productTypes"]["subscription"]
      : never
    : never;
} & {
  _: {
    paymentProviders: TDefinedProviders;
  };
};

export type InferProductConfigurationPerks<TDefinedPerks extends DefinedPerks> =
  {
    [K in keyof TDefinedPerks]?: TDefinedPerks[K] extends PerkDefinition
      ? true
      : never;
  } & {
    _: {
      perks: TDefinedPerks;
    };
  };

export type AnyDefinedProviders = DefinedProviders;
export type AnyDefinedPerks = DefinedPerks;
export type AnyPaywallLocationDefinition = PaywallLocationDefinition<string>;
export type AnyProductDefinition = ProductDefinition<
  // biome-ignore lint/suspicious/noExplicitAny: ok
  any,
  // biome-ignore lint/suspicious/noExplicitAny: ok
  Record<string, any>,
  // biome-ignore lint/suspicious/noExplicitAny: ok
  any
>;

/**
 * Type representing any schema configuration object.
 * Schema configurations contain providers and perks definitions,
 * along with methods to create product definitions.
 */
export interface AnySchemaConfiguration {
  providers: AnyDefinedProviders;
  perks: AnyDefinedPerks;
  // biome-ignore lint/suspicious/noExplicitAny: needed for flexibility
  subscription: (...args: any[]) => AnyProductDefinition;
  // biome-ignore lint/suspicious/noExplicitAny: needed for flexibility
  location: (...args: any[]) => AnyPaywallLocationDefinition;
}

export interface ProductDefinitionConfiguration<
  TDefinedProviders extends DefinedProviders,
  TDefinedPerks extends DefinedPerks,
> {
  providers: InferProductConfigurationProviders<TDefinedProviders>;
  perks: InferProductConfigurationPerks<TDefinedPerks>;
}

export type ProductDefinitionConfigureProvidersFn = <
  TDefinedProviders extends DefinedProviders,
>(
  providers: TDefinedProviders,
  configureFn: () => Omit<
    InferProductConfigurationProviders<TDefinedProviders>,
    "_"
  >
) => InferProductConfigurationProviders<TDefinedProviders>;

export type ProductDefinitionConfigurePerksFn = <
  TDefinedPerks extends DefinedPerks,
>(
  perks: TDefinedPerks,
  configureFn: () => Omit<InferProductConfigurationPerks<TDefinedPerks>, "_">
) => InferProductConfigurationPerks<TDefinedPerks>;

export type InferProductDefinitionConfigurationFn<
  TDefinedProviders extends DefinedProviders = DefinedProviders,
  TDefinedPerks extends DefinedPerks = DefinedPerks,
  TDefinitionProperties extends Record<string, unknown> = Record<
    string,
    unknown
  >,
> = (funs: {
  configureProviders: ProductDefinitionConfigureProvidersFn;
  configurePerks: ProductDefinitionConfigurePerksFn;
}) => ProductDefinitionConfiguration<TDefinedProviders, TDefinedPerks> &
  TDefinitionProperties;

// ===============================
// Get products
// ===============================

export type InferGetProductResponseFromSchema<TSchema extends VoidhashSchema> =
  Simplify<{
    [K in ExtractSchemaProductKeys<TSchema>]: TSchema[K] extends AnyProductDefinition
      ? TSchema[K]["type"] extends "subscription"
        ? SubscriptionProduct | null
        : never
      : never;
  }>;

// ===============================
// Schema
// ===============================

/**
 * A Voidhash schema can contain:
 * - Product definitions (subscriptions, one-time purchases, etc.)
 * - Schema configuration objects (which contain providers and perks)
 */
export type VoidhashSchema = Record<
  string,
  AnyProductDefinition | AnySchemaConfiguration | AnyPaywallLocationDefinition
>;

export type ExtractSchemaKeys<TSchema extends VoidhashSchema> = keyof TSchema;

export type ExtractSchemaProductKeys<TSchema extends VoidhashSchema> = {
  [K in keyof TSchema]: TSchema[K] extends AnyProductDefinition ? K : never;
}[keyof TSchema];

export type ExtractSchemaProductDefinitions<TSchema extends VoidhashSchema> = {
  [K in ExtractSchemaProductKeys<TSchema>]: TSchema[K] extends AnyProductDefinition
    ? TSchema[K]
    : never;
};

export type ExtractSchemaConfigurationKeys<TSchema extends VoidhashSchema> = {
  [K in keyof TSchema]: TSchema[K] extends AnySchemaConfiguration ? K : never;
}[keyof TSchema];

export type ExtractSchemaConfigurations<TSchema extends VoidhashSchema> = {
  [K in ExtractSchemaConfigurationKeys<TSchema>]: TSchema[K] extends AnySchemaConfiguration
    ? TSchema[K]
    : never;
};

export type ExtractSchemaPaywallLocationKeys<TSchema extends VoidhashSchema> = {
  [K in keyof TSchema]: TSchema[K] extends AnyPaywallLocationDefinition
    ? K
    : never;
}[keyof TSchema];

export type ExtractSchemaPaywallLocationDefinitions<
  TSchema extends VoidhashSchema,
> = {
  [K in ExtractSchemaPaywallLocationKeys<TSchema>]: TSchema[K] extends AnyPaywallLocationDefinition
    ? TSchema[K]
    : never;
};

export type ExtractSchemaPaywallLocationSlugs<
  TSchema extends VoidhashSchema,
> = {
  [K in ExtractSchemaPaywallLocationKeys<TSchema>]: TSchema[K] extends AnyPaywallLocationDefinition
    ? TSchema[K]["slug"]
    : never;
}[ExtractSchemaPaywallLocationKeys<TSchema>];

export type InferGetPaywallLocationInput<TSchema extends VoidhashSchema> =
  [ExtractSchemaPaywallLocationSlugs<TSchema>] extends [never]
    ? string
    : ExtractSchemaPaywallLocationSlugs<TSchema>;
