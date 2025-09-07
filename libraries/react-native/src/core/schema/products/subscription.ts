import type {
  DefinedPerks,
  DefinedProviders,
  InferProductDefinitionConfigurationFn
} from '../types';
import { ProductDefinition, productConfigurationFactory } from './base';

export type SubscriptionDefinitionProperties = {
  name: string;
};

const subscriptionConfigurationFactory = productConfigurationFactory();

export class SubscriptionProductDefinition<
  TDefinitionProperties extends SubscriptionDefinitionProperties,
  TDefinedProviders extends DefinedProviders = DefinedProviders,
  TDefinedPerks extends DefinedPerks = DefinedPerks
> extends ProductDefinition<
  'subscription',
  TDefinitionProperties,
  ReturnType<
    InferProductDefinitionConfigurationFn<TDefinedProviders, TDefinedPerks>
  >
> {}

export function subscription<
  TDefinedProviders extends DefinedProviders,
  TDefinedPerks extends DefinedPerks
>(
  slug: string,
  configurationFn: InferProductDefinitionConfigurationFn<
    TDefinedProviders,
    TDefinedPerks,
    SubscriptionDefinitionProperties
  >
) {
  const configuration = configurationFn({
    configureProviders: subscriptionConfigurationFactory.configureProviders,
    configurePerks: subscriptionConfigurationFactory.configurePerks
  });

  const properties: SubscriptionDefinitionProperties = {
    name: configuration.name
  };

  return new SubscriptionProductDefinition<
    SubscriptionDefinitionProperties,
    TDefinedProviders,
    TDefinedPerks
  >('subscription', slug, properties, configuration);
}
