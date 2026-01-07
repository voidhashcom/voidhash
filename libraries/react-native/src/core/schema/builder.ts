import {
  type SubscriptionDefinitionProperties,
  subscription as createSubscription,
} from "./products/subscription";
import type {
  DefinedPerks,
  DefinedProviders,
  InferProductConfigurationPerks,
  InferProductConfigurationProviders,
} from "./types";

/**
 * Configuration for creating a schema configuration
 */
export interface SchemaConfig<
  TProviders extends DefinedProviders,
  TPerks extends DefinedPerks,
> {
  providers: TProviders;
  perks: TPerks;
}

/**
 * Simplified subscription configuration that doesn't require callback functions
 */
export interface SubscriptionConfig<
  TProviders extends DefinedProviders,
  TPerks extends DefinedPerks,
> {
  name: string;
  perks: Omit<InferProductConfigurationPerks<TPerks>, "_">;
  providers: Omit<InferProductConfigurationProviders<TProviders>, "_">;
}

/**
 * Schema configuration object with access to providers, perks, and product builders
 */
export interface SchemaConfiguration<
  TProviders extends DefinedProviders,
  TPerks extends DefinedPerks,
> {
  providers: TProviders;
  perks: TPerks;
  subscription: (
    slug: string,
    subscriptionConfig: SubscriptionConfig<TProviders, TPerks>
  ) => ReturnType<typeof createSubscription>;
}

/**
 * Creates a schema configuration with improved DX.
 * Providers and perks are defined once, then products reference them directly.
 * Export the configuration to access providers and perks later.
 *
 * @example
 * ```typescript
 * export const schema = schemaConfiguration({
 *   providers: {
 *     googlePlay: true,
 *     appleAppStore: true
 *   },
 *   perks: {
 *     allAccess: unlockablePerk('all-access', { name: 'All Access' })
 *   }
 * });
 *
 * export const monthlySub = schema.subscription('monthly_sub', {
 *   name: 'Monthly',
 *   perks: { allAccess: true },
 *   providers: {
 *     googlePlay: { productId: 'com.example.monthly' },
 *     appleAppStore: { productId: 'monthly_sub' }
 *   }
 * });
 *
 * // Access perks later
 * const allAccessPerk = schema.perks.allAccess;
 * ```
 */
export function schemaConfiguration<
  TProviders extends DefinedProviders,
  TPerks extends DefinedPerks,
>(
  config: SchemaConfig<TProviders, TPerks>
): SchemaConfiguration<TProviders, TPerks> {
  const { providers, perks } = config;

  return {
    providers,
    perks,
    /**
     * Define a subscription product
     */
    subscription: (
      slug: string,
      subscriptionConfig: SubscriptionConfig<TProviders, TPerks>
    ) =>
      createSubscription(slug, (s) => {
        const perksConfig = s.configurePerks(
          perks,
          () => subscriptionConfig.perks
        );
        const providersConfig = s.configureProviders(
          providers,
          () => subscriptionConfig.providers
        );

        return {
          name: subscriptionConfig.name,
          perks: perksConfig,
          providers: providersConfig,
        } as SubscriptionDefinitionProperties & {
          perks: InferProductConfigurationPerks<TPerks>;
          providers: InferProductConfigurationProviders<TProviders>;
        };
      }),
  };
}
